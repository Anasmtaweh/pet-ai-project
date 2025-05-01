// c:\Users\Anas\Desktop\backend\server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedules');
const gptRoutes = require('./routes/gpt');
const { version } = require('./package.json'); // Assuming package.json is in backend root

// --- Reminder System Imports ---
const cron = require('node-cron'); // Ensure 'node-cron' is installed
const moment = require('moment-timezone'); // Ensure 'moment-timezone' is installed
const Schedule = require('./models/Schedule');
const User = require('./models/User'); // Needed if not populating email during Schedule find
const SentReminder = require('./models/SentReminder');
const { generateOccurrencesInRange } = require('./utils/scheduleUtils');
const { sendReminderEmail } = require('./utils/mailer');
// --- End Reminder System Imports ---

const app = express();
const port = process.env.PORT || 3001; // Use environment variable or default

// --- Middleware ---
app.use(express.json());

// Specific CORS Configuration
const allowedOrigins = [
    'http://localhost:3000', // Your local frontend
    'http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com' // Your S3 frontend
    // Add other origins if needed
];
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: "Content-Type, Authorization, X-Requested-With"
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests for all routes
// --- End CORS ---


// --- Database Connection ---
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(config.DB_URL)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => {
            console.error('Error connecting to MongoDB:', err);
            // process.exit(1); // Consider exiting if DB connection is critical for production
        });
} else {
    console.log('Skipping global MongoDB connection in test environment.'); // Optional log
}
// --- End DB Connection ---


// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: version || 'unknown',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});
// --- End Health Check ---


// --- Routes ---
app.get('/', (req, res) => {
    res.send('Pet AI Backend Service');
});
app.use('/auth', authRoutes);
app.use('/pets', petRoutes);
app.use('/admin', adminRoutes);
app.use('/schedules', scheduleRoutes);
app.use('/gpt', gptRoutes);
// --- End Routes ---


// --- START: Reminder Cron Job Setup (WITH DUPLICATE PREVENTION) ---
const reminderJobTimezone = "Asia/Beirut";

// --- DEFINE THE EXPORTABLE JOB FUNCTION ---
async function runReminderCheckJob() {
    const jobStartTime = moment();
    console.log(`[${jobStartTime.tz(reminderJobTimezone).format()}] Running reminder check job...`);

    // Define window relative to current UTC time
    const reminderWindowStartUTC = moment.utc().add(15, 'minutes');
    const reminderWindowEndUTC = moment.utc().add(30, 'minutes');
    console.log(`Reminder Window (UTC): [${reminderWindowStartUTC.toISOString()}, ${reminderWindowEndUTC.toISOString()})`);

    try {
        // Fetch rules and populate owner email for sending
        const rules = await Schedule.find().populate('owner', 'email');

        if (!rules || rules.length === 0) {
            console.log("No schedule rules found for reminder check.");
            // No need to return anything specific, just finish
        } else {
            let upcomingOccurrences = [];
            rules.forEach(rule => {
                // Prepare data for generateOccurrencesInRange
                // It expects ownerId, title etc. directly on the object
                const ruleDataForGeneration = {
                    ...rule.toObject(), // Convert Mongoose doc to plain object first
                    ownerId: rule.owner?._id?.toString(), // Get ownerId if populated
                    // title, start, end, repeat, repeatType, exceptionDates etc. are on rule.toObject()
                };

                // Generate occurrences within the window
                const occurrences = generateOccurrencesInRange(
                    ruleDataForGeneration,
                    reminderWindowStartUTC.toDate(),
                    reminderWindowEndUTC.toDate()
                );

                // Add owner email back to each occurrence object for easy access later
                occurrences.forEach(occ => {
                    occ.ownerEmail = rule.owner?.email;
                });

                upcomingOccurrences.push(...occurrences);
            });

            console.log(`Found ${upcomingOccurrences.length} total upcoming occurrences in the window.`);

            // Process each upcoming occurrence
            for (const occurrence of upcomingOccurrences) {
                // Generate a unique key for this specific occurrence instance
                const reminderKey = `${occurrence.ruleId}_${occurrence.start.getTime()}`;
                let reminderAlreadySent = false;

                // Check if reminder was already sent
                try {
                    const existingReminder = await SentReminder.findOne({ reminderKey: reminderKey });
                    if (existingReminder) {
                        reminderAlreadySent = true;
                        console.log(`Reminder already sent for key ${reminderKey}, skipping.`);
                    }
                } catch (checkError) {
                    console.error(`Error checking for existing reminder ${reminderKey}:`, checkError);
                    continue; // Skip this occurrence if DB check fails
                }

                if (reminderAlreadySent) {
                    continue; // Skip if already sent
                }

                // Proceed only if reminder was NOT already sent
                const ownerEmail = occurrence.ownerEmail; // Get email added earlier

                if (ownerEmail) {
                    const eventStartTimeLocal = moment(occurrence.start).tz(reminderJobTimezone).format('h:mm a');
                    console.log(`Attempting to send reminder for "${occurrence.title}" (Starts: ${eventStartTimeLocal}) to ${ownerEmail}`);
                    try {
                        // Attempt to send the email
                        await sendReminderEmail(
                            ownerEmail,
                            occurrence.title,
                            occurrence.start // Pass the JS Date object (UTC)
                        );

                        // Mark reminder as sent in DB (AFTER successful send)
                        try {
                            const newSentReminder = new SentReminder({
                                reminderKey: reminderKey,
                                ruleId: occurrence.ruleId,
                                occurrenceStartTime: occurrence.start,
                                recipientEmail: ownerEmail
                                // sentAt defaults to Date.now()
                            });
                            await newSentReminder.save();
                            console.log(`Marked reminder as sent for key ${reminderKey}`);
                        } catch (saveError) {
                            if (saveError.code === 11000) { // Handle potential race condition (duplicate key)
                                console.warn(`Race condition: Reminder ${reminderKey} was likely marked as sent by another process.`);
                            } else {
                                console.error(`Error marking reminder ${reminderKey} as sent:`, saveError);
                            }
                        }
                    } catch (emailError) {
                        console.error(`Error sending reminder email for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}:`, emailError);
                    }
                } else {
                    // Log if owner email wasn't found (might indicate data issue or population failure)
                    console.warn(`Cannot send reminder for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}: Owner email not found.`);
                }
            } // End for loop over occurrences
        } // End else block (if rules exist)
    } catch (error) {
        console.error("Error during reminder check job:", error);
    }
    console.log(`[${moment().tz(reminderJobTimezone).format()}] Reminder check job finished.`);
}
// --- END DEFINED FUNCTION ---


// --- START: Conditionally Schedule Cron Job ---
// Only schedule the job if NOT running in the 'test' environment
if (process.env.NODE_ENV !== 'test') {
    console.log(`Scheduling reminder job with timezone: ${reminderJobTimezone}`);
    // Schedule the job to run every 15 minutes
    cron.schedule('*/15 * * * *', runReminderCheckJob, {
        scheduled: true,
        timezone: reminderJobTimezone
    });
    console.log(`Reminder cron job scheduled (UTC focused, with duplicate prevention).`);
} else {
    // Optional: Log that scheduling is skipped during tests
    console.log('Skipping cron job scheduling in test environment.');
}
// --- END: Conditionally Schedule Cron Job ---
// --- END: Reminder Cron Job Setup ---


// --- EXPORT APP and JOB FUNCTION ---
// Export both the Express app and the job function for testing
module.exports = { app, runReminderCheckJob };
// --- END EXPORT ---


// --- Start Server (Only if run directly using 'node server.js') ---
// This prevents the server from starting automatically when required by tests
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Backend server is running on port ${port}`);
    });
}
// --- End Start Server ---
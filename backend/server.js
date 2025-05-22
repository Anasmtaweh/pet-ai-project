const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedules');
const gptRoutes = require('./routes/gpt');
const { version } = require('./package.json'); // For health check endpoint

// --- Reminder System Imports ---
// Modules required for the scheduled reminder email functionality.
const cron = require('node-cron');
const moment = require('moment-timezone');
const Schedule = require('./models/Schedule');
const User = require('./models/User');
const SentReminder = require('./models/SentReminder');
const { generateOccurrencesInRange } = require('./utils/scheduleUtils');
const { sendReminderEmail } = require('./utils/mailer');

const app = express();
const port = process.env.PORT || 3001; // Server port configuration.

// --- Middleware Setup ---
// Parses incoming JSON requests.
app.use(express.json());

// Configures Cross-Origin Resource Sharing (CORS) with specific allowed origins.
const allowedOrigins = [
    'http://localhost:3000', // Local frontend development
    'http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com' // S3 hosted frontend
];
const corsOptions = {
    origin: function (origin, callback) {
        // Allows requests with no origin (e.g., mobile apps, curl) and from whitelisted origins.
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
// Handles preflight OPTIONS requests for all routes.
app.options('*', cors(corsOptions));


// --- Database Connection ---
// Connects to MongoDB, unless in a 'test' environment.
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(config.DB_URL)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => {
            console.error('Error connecting to MongoDB:', err);
        });
} else {
    // Logs that DB connection is skipped during tests.
    console.log('Skipping global MongoDB connection in test environment.');
}


// --- Health Check Endpoint ---
// Provides a basic health status of the application.
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: version || 'unknown',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});


// --- Application Routes ---
// Defines the main routes for the application.
app.get('/', (req, res) => {
    res.send('Pet AI Backend Service');
});
app.use('/auth', authRoutes);       // Authentication routes.
app.use('/pets', petRoutes);        // Pet management routes.
app.use('/admin', adminRoutes);     // Admin panel routes.
app.use('/schedules', scheduleRoutes); // Schedule management routes.
app.use('/gpt', gptRoutes);         // GPT interaction routes.


// --- Reminder Cron Job Setup ---
// Timezone configuration for the reminder job.
const reminderJobTimezone = "Asia/Beirut";

// Function to check for upcoming schedules and send reminder emails.
// This function is exported for testing purposes.
async function runReminderCheckJob() {
    const jobStartTime = moment();
    console.log(`[${jobStartTime.tz(reminderJobTimezone).format()}] Running reminder check job...`);

    // Defines the time window (15 to 30 minutes from now) for sending reminders.
    const reminderWindowStartUTC = moment.utc().add(15, 'minutes');
    const reminderWindowEndUTC = moment.utc().add(30, 'minutes');
    console.log(`Reminder Window (UTC): [${reminderWindowStartUTC.toISOString()}, ${reminderWindowEndUTC.toISOString()})`);

    try {
        // Fetches all schedule rules and populates owner's email for sending reminders.
        const rules = await Schedule.find().populate('owner', 'email');

        if (!rules || rules.length === 0) {
            console.log("No schedule rules found for reminder check.");
        } else {
            let upcomingOccurrences = [];
            // Generates specific occurrences for each rule within the defined window.
            rules.forEach(rule => {
                const ruleDataForGeneration = {
                    ...rule.toObject(),
                    ownerId: rule.owner?._id?.toString(),
                };
                const occurrences = generateOccurrencesInRange(
                    ruleDataForGeneration,
                    reminderWindowStartUTC.toDate(),
                    reminderWindowEndUTC.toDate()
                );
                occurrences.forEach(occ => {
                    occ.ownerEmail = rule.owner?.email; // Attach owner's email to the occurrence.
                });
                upcomingOccurrences.push(...occurrences);
            });

            console.log(`Found ${upcomingOccurrences.length} total upcoming occurrences in the window.`);

            // Processes each upcoming occurrence to send a reminder if not already sent.
            for (const occurrence of upcomingOccurrences) {
                const reminderKey = `${occurrence.ruleId}_${occurrence.start.getTime()}`;
                let reminderAlreadySent = false;

                // Checks if a reminder for this specific occurrence has already been sent.
                try {
                    const existingReminder = await SentReminder.findOne({ reminderKey: reminderKey });
                    if (existingReminder) {
                        reminderAlreadySent = true;
                        console.log(`Reminder already sent for key ${reminderKey}, skipping.`);
                    }
                } catch (checkError) {
                    console.error(`Error checking for existing reminder ${reminderKey}:`, checkError);
                    continue;
                }

                if (reminderAlreadySent) {
                    continue;
                }

                // Sends the reminder email and marks it as sent in the database.
                const ownerEmail = occurrence.ownerEmail;
                if (ownerEmail) {
                    const eventStartTimeLocal = moment(occurrence.start).tz(reminderJobTimezone).format('h:mm a');
                    console.log(`Attempting to send reminder for "${occurrence.title}" (Starts: ${eventStartTimeLocal}) to ${ownerEmail}`);
                    try {
                        await sendReminderEmail(
                            ownerEmail,
                            occurrence.title,
                            occurrence.start
                        );
                        // Records that the reminder was sent to prevent duplicates.
                        try {
                            const newSentReminder = new SentReminder({
                                reminderKey: reminderKey,
                                ruleId: occurrence.ruleId,
                                occurrenceStartTime: occurrence.start,
                                recipientEmail: ownerEmail
                            });
                            await newSentReminder.save();
                            console.log(`Marked reminder as sent for key ${reminderKey}`);
                        } catch (saveError) {
                            if (saveError.code === 11000) { // Handles potential race conditions.
                                console.warn(`Race condition: Reminder ${reminderKey} was likely marked as sent by another process.`);
                            } else {
                                console.error(`Error marking reminder ${reminderKey} as sent:`, saveError);
                            }
                        }
                    } catch (emailError) {
                        console.error(`Error sending reminder email for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}:`, emailError);
                    }
                } else {
                    console.warn(`Cannot send reminder for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}: Owner email not found.`);
                }
            }
        }
    } catch (error) {
        console.error("Error during reminder check job:", error);
    }
    console.log(`[${moment().tz(reminderJobTimezone).format()}] Reminder check job finished.`);
}


// --- Conditionally Schedule Cron Job ---
// Schedules the reminder job to run every 15 minutes, except in 'test' environment.
if (process.env.NODE_ENV !== 'test') {
    console.log(`Scheduling reminder job with timezone: ${reminderJobTimezone}`);
    cron.schedule('*/15 * * * *', runReminderCheckJob, {
        scheduled: true,
        timezone: reminderJobTimezone
    });
    console.log(`Reminder cron job scheduled (UTC focused, with duplicate prevention).`);
} else {
    console.log('Skipping cron job scheduling in test environment.');
}


// --- Export App and Job Function ---
// Exports the Express app and the reminder job function, primarily for testing.
module.exports = { app, runReminderCheckJob };


// --- Start Server ---
// Starts the Express server if the script is run directly (not when required as a module).
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Backend server is running on port ${port}`);
    });
}

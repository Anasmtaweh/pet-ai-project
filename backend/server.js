// c:\Users\Anas\M5\pet-ai-project\backend\server.js

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
const SentReminder = require('./models/SentReminder'); // <-- IMPORT NEW MODEL
const { generateOccurrencesInRange } = require('./utils/scheduleUtils'); // Ensure this file exists and is correct
const { sendReminderEmail } = require('./utils/mailer'); // Ensure this file exists and is correct
// --- End Reminder System Imports ---

const app = express();
const port = 3001;

// --- Middleware ---
app.use(express.json());

// Specific CORS Configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com'
];
const corsOptions = {
    origin: function (origin, callback) {
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
app.options('*', cors(corsOptions)); // Handle preflight requests
// --- End CORS ---


// --- Database Connection ---
mongoose.connect(config.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));
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
console.log(`Scheduling reminder job with timezone: ${reminderJobTimezone}`);

cron.schedule('*/15 * * * *', async () => { // Run every 15 minutes
    const jobStartTime = moment();
    console.log(`[${jobStartTime.tz(reminderJobTimezone).format()}] Running reminder check job...`);

    const reminderWindowStartUTC = moment.utc().add(59, 'minutes');
    const reminderWindowEndUTC = moment.utc().add(74, 'minutes');
    console.log(`Reminder Window (UTC): [${reminderWindowStartUTC.toISOString()}, ${reminderWindowEndUTC.toISOString()})`);

    try {
        const rules = await Schedule.find().populate('owner', 'email');

        if (!rules || rules.length === 0) {
            console.log("No schedule rules found for reminder check.");
        } else {
            let upcomingOccurrences = [];
            rules.forEach(rule => {
                const occurrences = generateOccurrencesInRange(
                    rule,
                    reminderWindowStartUTC.toDate(),
                    reminderWindowEndUTC.toDate()
                );
                upcomingOccurrences.push(...occurrences);
            });

            console.log(`Found ${upcomingOccurrences.length} total upcoming occurrences in the window.`);

            for (const occurrence of upcomingOccurrences) {
                // --- START: Duplicate Prevention Check ---
                const reminderKey = `${occurrence.ruleId}_${occurrence.start.getTime()}`; // Unique key: ruleId + UTC timestamp ms
                let reminderAlreadySent = false;
                try {
                    // Check if a reminder record with this key already exists
                    const existingReminder = await SentReminder.findOne({ reminderKey: reminderKey });
                    if (existingReminder) {
                        reminderAlreadySent = true;
                        console.log(`Reminder already sent for key ${reminderKey}, skipping.`);
                    }
                } catch (checkError) {
                    console.error(`Error checking for existing reminder ${reminderKey}:`, checkError);
                    // If DB check fails, skip this occurrence to be safe
                    continue;
                }
                // --- END: Duplicate Prevention Check ---

                if (reminderAlreadySent) {
                    continue; // Skip to the next occurrence if already sent
                }

                // Proceed only if reminder was NOT already sent
                if (occurrence.ownerId && occurrence.ownerId.email) {
                    const eventStartTimeLocal = moment(occurrence.start).tz(reminderJobTimezone).format('h:mm a');
                    console.log(`Attempting to send reminder for "${occurrence.title}" (Starts: ${eventStartTimeLocal}) to ${occurrence.ownerId.email}`);
                    try {
                        // Attempt to send the email
                        await sendReminderEmail(
                            occurrence.ownerId.email,
                            occurrence.title,
                            occurrence.start // Pass the JS Date object (UTC)
                        );

                        // --- START: Mark Reminder as Sent (AFTER successful send) ---
                        try {
                            const newSentReminder = new SentReminder({
                                reminderKey: reminderKey,
                                ruleId: occurrence.ruleId,
                                occurrenceStartTime: occurrence.start,
                                recipientEmail: occurrence.ownerId.email
                                // sentAt will default to Date.now()
                            });
                            await newSentReminder.save(); // Save the record to DB
                            console.log(`Marked reminder as sent for key ${reminderKey}`);
                        } catch (saveError) {
                            // Handle potential race condition where another process saved the key just now
                            if (saveError.code === 11000) { // MongoDB duplicate key error code
                                console.warn(`Race condition: Reminder ${reminderKey} was likely marked as sent by another process.`);
                            } else {
                                // Log other save errors but don't necessarily stop the job
                                console.error(`Error marking reminder ${reminderKey} as sent:`, saveError);
                            }
                        }
                        // --- END: Mark Reminder as Sent ---

                    } catch (emailError) {
                        console.error(`Error sending reminder email for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}:`, emailError);
                        // Decide if you want to retry or just log
                    }
                } else {
                    console.warn(`Cannot send reminder for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}: Owner or owner email not found/populated.`);
                }
            } // End for loop
        } // End else block

    } catch (error) {
        console.error("Error during reminder check job:", error);
    }
     console.log(`[${moment().tz(reminderJobTimezone).format()}] Reminder check job finished.`);
}, {
    scheduled: true,
    timezone: reminderJobTimezone
});
console.log(`Reminder cron job scheduled (UTC focused, with duplicate prevention).`);
// --- END: Reminder Cron Job Setup ---


// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});
// --- End Start Server ---
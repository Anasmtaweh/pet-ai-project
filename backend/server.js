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


// --- START: Reminder Cron Job Setup (UTC Focused) ---
// Ensure necessary packages are installed: npm install node-cron moment-timezone
const reminderJobTimezone = "Asia/Beirut"; // Define timezone for scheduling and logging
console.log(`Scheduling reminder job with timezone: ${reminderJobTimezone}`);

cron.schedule('*/15 * * * *', async () => { // Run every 15 minutes
    const jobStartTime = moment(); // Use moment() which respects system time initially
    console.log(`[${jobStartTime.tz(reminderJobTimezone).format()}] Running reminder check job...`);

    // --- Calculate window in UTC ---
    // Get current time in UTC, add offsets
    const reminderWindowStartUTC = moment.utc().add(59, 'minutes');
    const reminderWindowEndUTC = moment.utc().add(74, 'minutes'); // 15 min window (59 to 74 mins from now)
    console.log(`Reminder Window (UTC): [${reminderWindowStartUTC.toISOString()}, ${reminderWindowEndUTC.toISOString()})`);
    // --- End UTC Window Calculation ---

    try {
        // Find rules and populate owner's email for sending reminders
        // Consider adding filters like { repeat: true } or based on activity if needed
        const rules = await Schedule.find().populate('owner', 'email'); // Populate owner email

        if (!rules || rules.length === 0) {
            console.log("No schedule rules found for reminder check.");
            // No return needed here, just proceed to finish log
        } else {
            let upcomingOccurrences = [];
            rules.forEach(rule => {
                // Generate occurrences within the UTC window
                // Pass JS Date objects (which represent UTC time) to the utility
                const occurrences = generateOccurrencesInRange(
                    rule,
                    reminderWindowStartUTC.toDate(),
                    reminderWindowEndUTC.toDate()
                );
                if (occurrences.length > 0) {
                    // console.log(`Found ${occurrences.length} occurrences for rule ${rule._id}`); // Optional detailed log
                    upcomingOccurrences.push(...occurrences);
                }
            });

            console.log(`Found ${upcomingOccurrences.length} total upcoming occurrences in the window.`);

            // Process reminders for found occurrences
            for (const occurrence of upcomingOccurrences) {
                // --- TODO: Implement robust duplicate prevention ---
                // This is crucial to avoid sending multiple reminders for the same event.
                // Example Strategy:
                // 1. Define a unique key for the reminder: `${occurrence.ruleId}_${occurrence.start.getTime()}`
                // 2. Check if this key exists in a 'sent reminders' cache (e.g., Redis, another DB collection) with an expiry.
                // 3. If not found: proceed to send, then add the key to the cache with an expiry (e.g., 1 hour).
                // 4. If found: skip sending.
                // console.log(`Checking duplicate prevention for: ${occurrence.ruleId}_${occurrence.start.getTime()}`); // Placeholder
                let reminderAlreadySent = false; // Replace with actual check
                // --- End TODO ---

                if (reminderAlreadySent) {
                    // console.log(`Reminder already sent for "${occurrence.title}" at ${moment(occurrence.start).tz(reminderJobTimezone).format()}, skipping.`);
                    continue; // Skip to the next occurrence
                }

                // Check if owner and email are populated correctly
                if (occurrence.ownerId && occurrence.ownerId.email) {
                    // Log the event time in the target timezone for clarity
                    const eventStartTimeLocal = moment(occurrence.start).tz(reminderJobTimezone).format('h:mm a');
                    console.log(`Attempting to send reminder for "${occurrence.title}" (Starts: ${eventStartTimeLocal}) to ${occurrence.ownerId.email}`);
                    try {
                        await sendReminderEmail(
                            occurrence.ownerId.email,
                            occurrence.title,
                            occurrence.start // Pass the JS Date object (UTC)
                        );
                        // --- TODO: Mark reminder as sent after successful sending ---
                        // e.g., add `${occurrence.ruleId}_${occurrence.start.getTime()}` to cache/DB
                        // console.log(`Marking reminder as sent for: ${occurrence.ruleId}_${occurrence.start.getTime()}`); // Placeholder
                        // --- End TODO ---
                    } catch (emailError) {
                        console.error(`Error sending reminder email for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}:`, emailError);
                        // Decide if you want to continue processing other reminders or stop
                    }
                } else {
                    console.warn(`Cannot send reminder for rule ${occurrence.ruleId}, occurrence start ${occurrence.start.toISOString()}: Owner or owner email not found/populated.`);
                }
            }
        }

    } catch (error) {
        console.error("Error during reminder check job:", error);
    }
     // Log job finish time using the target timezone
     console.log(`[${moment().tz(reminderJobTimezone).format()}] Reminder check job finished.`);
}, {
    scheduled: true,
    timezone: reminderJobTimezone // Use the defined timezone for CRON scheduling
});
console.log(`Reminder cron job scheduled to run every 15 minutes (Timezone: ${reminderJobTimezone}).`);
// --- END: Reminder Cron Job Setup ---


// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});
// --- End Start Server ---


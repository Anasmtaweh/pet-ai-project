// c:\Users\Anas\M5\pet-ai-project\backend\models\SentReminder.js
const mongoose = require('mongoose');

const sentReminderSchema = new mongoose.Schema({
    // Unique key combining rule ID and the specific occurrence start time (as timestamp)
    reminderKey: {
        type: String,
        required: true,
        unique: true, // Ensure we don't store duplicates
        index: true, // Index for faster lookups
    },
    sentAt: {
        type: Date,
        default: Date.now,
        // Automatically remove documents after, e.g., 2 hours to keep collection clean
        // This prevents the collection from growing indefinitely. Adjust time as needed.
        expires: 7200, // TTL in seconds (2 hours = 2 * 60 * 60)
    },
    // Optional fields for easier debugging/querying
    ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule',
    },
    occurrenceStartTime: {
        type: Date,
    },
    recipientEmail: {
        type: String,
    }
});

// You might want to explicitly create the TTL index if 'expires' doesn't work as expected
// sentReminderSchema.index({ sentAt: 1 }, { expireAfterSeconds: 7200 });

const SentReminder = mongoose.model('SentReminder', sentReminderSchema, 'sentReminders');

module.exports = SentReminder;

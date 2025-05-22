// Defines the schema for tracking sent reminders in the MongoDB collection.
// This is primarily used to prevent sending duplicate reminders for the same scheduled occurrence.
const mongoose = require('mongoose');

const sentReminderSchema = new mongoose.Schema({
    // Unique key combining rule ID and the specific occurrence start time (as timestamp)
    // This key uniquely identifies a specific instance of a repeating schedule.
    reminderKey: {
        type: String,
        required: true,
        unique: true, // Ensure we don't store duplicates
        index: true, // Index for faster lookups
    },
    // Timestamp when the reminder was sent.
    sentAt: {
        type: Date,
        default: Date.now,
        // Automatically remove documents after, e.g., 2 hours to keep collection clean
        // This prevents the collection from growing indefinitely. Adjust time as needed.
        expires: 7200, // TTL in seconds (2 hours = 2 * 60 * 60)
    },
    // Optional fields for easier debugging/querying - link back to the original schedule rule.
    ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule', // References the Schedule model.
    },
    // Optional field storing the exact start time of the occurrence for which the reminder was sent.
    occurrenceStartTime: {
        type: Date,
    },
    // Optional field storing the email address the reminder was sent to.
    recipientEmail: {
        type: String,
    }
});

// This commented-out line shows how the TTL index could be explicitly defined,
// but the 'expires' option in the schema field definition achieves the same result.
// sentReminderSchema.index({ sentAt: 1 }, { expireAfterSeconds: 7200 });

// Creates the Mongoose model named 'SentReminder' using the defined schema.
// The third argument 'sentReminders' explicitly sets the collection name in MongoDB.
const SentReminder = mongoose.model('SentReminder', sentReminderSchema, 'sentReminders');

module.exports = SentReminder;

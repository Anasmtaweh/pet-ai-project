const mongoose = require('mongoose');

// Defines the schema for schedule documents in the MongoDB collection.
// Schedules can represent various pet-related events like meals, vet visits, etc.
const scheduleSchema = new mongoose.Schema({
    // Title or name of the scheduled event.
    title: {
        type: String,
        required: true, // Title is a mandatory field.
        trim: true,     // Automatically removes leading/trailing whitespace.
    },
    // Start date and time of the scheduled event.
    start: {
        type: Date,
        required: true, // Start time is mandatory.
    },
    // End date and time of the scheduled event.
    end: {
        type: Date,
        required: true, // End time is mandatory.
    },
    // Type of the scheduled event, restricted to predefined categories.
    type: {
        type: String,
        // Enum restricts the 'type' field to one of these predefined values.
        enum: ['meal', 'vet', 'play', 'sleep', 'medication'],
        required: true, // Type of event is mandatory.
    },
    // Boolean flag indicating if the event repeats.
    repeat: {
        type: Boolean,
        default: false, // Defaults to false (non-repeating) if not specified.
    },
    // Type of repetition, if 'repeat' is true.
    repeatType: {
        type: String,
        // Enum restricts 'repeatType' to 'daily' or 'weekly'.
        enum: ['daily', 'weekly'],
        default: 'daily', // Defaults to 'daily' repetition if 'repeat' is true and 'repeatType' is not specified.
    },
    // Specific days of the week for weekly repetition (e.g., ['Monday', 'Wednesday']).
    // Relevant only if 'repeat' is true and 'repeatType' is 'weekly'.
    repeatDays: {
        type: [String], // Defines an array of strings.
        default: [],    // Defaults to an empty array.
    },
    // Reference to the User who owns this schedule.
    owner: {
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the owner.
        ref: 'User',                          // Establishes a reference to the 'User' model.
        required: true,                       // Owner is mandatory.
    },
    // Array of specific start dates/times of occurrences that should be excluded from a repeating schedule.
    // This allows users to skip individual instances of a recurring event.
    exceptionDates: {
        type: [Date], // Array of specific start times to exclude
        default: [],  // Defaults to an empty array.
    }
}, {
    // Mongoose options:
    timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields to documents.
});

// Creates the Mongoose model named 'Schedule' using the defined schema.
// The third argument 'schedules' explicitly sets the collection name in MongoDB.
const Schedule = mongoose.model('Schedule', scheduleSchema, 'schedules');

module.exports = Schedule;


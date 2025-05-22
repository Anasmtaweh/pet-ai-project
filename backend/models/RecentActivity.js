const mongoose = require('mongoose');

// Defines the schema for logging recent activities within the application.
// This is useful for auditing, displaying activity feeds, or administrative oversight.
const recentActivitySchema = new mongoose.Schema({
    // Type of activity that occurred. This is a controlled list of possible actions.
    type: {
        type: String,
        required: true, // The type of activity is mandatory.
        // Enum restricts the 'type' field to one of these predefined values.
        enum: [
            'user_signup',      // Indicates a new user registration.
            'pet_added',        // Indicates a new pet was added.
            'schedule_added',   // Indicates a new schedule was created.
            'user_deleted',     // Indicates a user account was deleted.
            'pet_deleted',      // Indicates a pet was deleted.
            'schedule_deleted'  // Indicates a schedule was deleted.
        ],
    },
    // Timestamp indicating when the activity occurred.
    timestamp: {
        type: Date,
        default: Date.now, // Defaults to the current date and time when the activity log is created.
    },
    // A human-readable string providing more specific details about the activity.
    details: {
        type: String,
        required: true, // Details about the activity are mandatory.
    },
    // Optional reference to the User associated with this activity.
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the associated user.
        ref: 'User',                          // Establishes a reference to the 'User' model.
    },
    // Optional reference to the Pet associated with this activity.
    petId: {
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the associated pet.
        ref: 'Pet',                           // Establishes a reference to the 'Pet' model.
    },
    // Optional reference to the Schedule associated with this activity.
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the associated schedule.
        ref: 'Schedule',                      // Establishes a reference to the 'Schedule' model.
    },
});

// Creates the Mongoose model named 'RecentActivity' using the defined schema.
// The third argument 'recentActivities' explicitly sets the collection name in MongoDB.
const RecentActivity = mongoose.model('RecentActivity', recentActivitySchema, 'recentActivities');

module.exports = RecentActivity;

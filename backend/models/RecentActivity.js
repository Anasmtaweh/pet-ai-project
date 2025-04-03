const mongoose = require('mongoose');

const recentActivitySchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['user_signup', 'pet_added', 'schedule_added', 'user_deleted', 'pet_deleted', 'schedule_deleted'],
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    details: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
    },
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule',
    },
});

const RecentActivity = mongoose.model('RecentActivity', recentActivitySchema, 'recentActivities');

module.exports = RecentActivity;

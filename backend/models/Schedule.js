const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    start: {
        type: Date,
        required: true,
    },
    end: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        enum: ['meal', 'vet', 'play', 'sleep', 'medication'],
        required: true,
    },
    repeat: {
        type: Boolean,
        default: false,
    },
    repeatType: {
        type: String,
        enum: ['daily', 'weekly'],
        default: 'daily',
    },
    repeatDays: {
        type: [String],
        default: [],
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

const Schedule = mongoose.model('Schedule', scheduleSchema, 'schedules');

module.exports = Schedule;

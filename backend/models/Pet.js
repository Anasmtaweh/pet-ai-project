const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    ageYears: {
        type: Number,
        required: true,
        min: 0,
    },
    ageMonths: {
        type: Number,
        required: true,
        min: 0,
        max: 11,
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
    },
    species: {
        type: String,
        enum: ['Cat', 'Dog'],
        required: true,
    },
    breed: {
        type: String,
        required: true,
    },
    medicalInfo: {
        type: String,
        trim: true,
    },
    pictures: {
        type: [String], // Array of picture URLs
        default: [],
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true, // Add createdAt and updatedAt timestamps
});

const Pet = mongoose.model('Pet', petSchema, 'pets');

module.exports = Pet;

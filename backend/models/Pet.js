const mongoose = require('mongoose');

// Defines the schema for pet documents in the MongoDB collection.
const petSchema = new mongoose.Schema({
    // Name of the pet.
    name: {
        type: String,
        required: true, // Name is a mandatory field.
        trim: true,     // Automatically removes leading/trailing whitespace.
    },
    // Age of the pet in years.
    ageYears: {
        type: Number,
        required: true, // Age in years is mandatory.
        min: 0,         // Age cannot be negative.
    },
    // Age of the pet in months (0-11).
    ageMonths: {
        type: Number,
        required: true, // Age in months is mandatory.
        min: 0,         // Months cannot be negative.
        max: 11,        // Months cannot exceed 11.
    },
    // Weight of the pet.
    weight: {
        type: Number,
        required: true, // Weight is mandatory.
        min: 0,         // Weight cannot be negative.
    },
    // Species of the pet, restricted to 'Cat' or 'Dog'.
    species: {
        type: String,
        enum: ['Cat', 'Dog'], // Allowed values for species.
        required: true,       // Species is mandatory.
    },
    // Gender of the pet, restricted to 'Male' or 'Female'.
    gender: {
        type: String,
        enum: ['Male', 'Female'], // Allowed values for gender.
        required: true,           // Gender is mandatory.
    },
    // Breed of the pet.
    breed: {
        type: String,
        required: true, // Breed is mandatory.
    },
    // Optional medical information about the pet.
    medicalInfo: {
        type: String,
        trim: true, // Automatically removes leading/trailing whitespace.
    },
    // Array of URLs pointing to pictures of the pet.
    pictures: {
        type: [String], // Defines an array of strings.
        default: [],    // Defaults to an empty array if no pictures are provided.
    },
    // Reference to the User who owns this pet.
    owner: {
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the owner.
        ref: 'User',                          // Establishes a reference to the 'User' model.
        required: true,                       // Owner is mandatory.
    },
}, {
    // Mongoose options:
    timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields.
});

// Creates the Mongoose model named 'Pet' using the defined schema.
// The third argument 'pets' explicitly sets the collection name in MongoDB.
const Pet = mongoose.model('Pet', petSchema, 'pets');

module.exports = Pet;



const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Defines the schema for user documents in the MongoDB collection.
const userSchema = new mongoose.Schema({
    // User's email address. Must be unique and in a valid format.
    email: {
        type: String,
        required: [true, 'Email is required'], // Custom message for required validation.
        unique: true, // Ensures email addresses are unique across all users.
        trim: true,     // Automatically removes leading/trailing whitespace.
        lowercase: true, // Converts email to lowercase before saving.
        // Regex to validate the email format.
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    // User's password. Stored as a hash.
    password: {
        type: String,
        required: [true, 'Password is required'], // Custom message for required validation.
        // Custom validator for password complexity.
        validate: {
            validator: function (v) {
                // Only validate complexity if the password is new or has been modified.
                // This prevents re-validation on every save if the password hasn't changed.
                if (!this.isModified('password')) return true;

                // Password must be at least 8 characters long,
                // include uppercase, lowercase, number, and a special character.
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-.])[A-Za-z\d@$!%*?&#+\-.]{8,}$/.test(v);
            },
            // Custom message for password complexity validation failure.
            message: props => `Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#+-. etc).`
        },
    },
    // User's chosen username.
    username: {
        type: String,
        required: [true, 'Username is required'], // Custom message for required validation.
        trim: true, // Automatically removes leading/trailing whitespace.
    },
    // User's age. Must be between 13 and 120.
    age: {
        type: Number,
        required: [true, 'Age is required'], // Custom message for required validation.
        min: [13, 'Age must be at least 13'], // Minimum age validation with custom message.
        max: [120, 'Age must be less than 120'], // Maximum age validation with custom message.
    },
    // User's role, restricted to 'user' or 'admin'.
    role: {
        type: String,
        enum: ['user', 'admin'], // Allowed values for role.
        default: 'user',         // Defaults to 'user' if not specified.
    },
    // Flag indicating if the user account is active.
    isActive: {
        type: Boolean,
        default: true, // Defaults to true (active) if not specified.
    },

}, {
    // Mongoose options:
    timestamps: true // Automatically adds `createdAt` and `updatedAt` fields to documents.
});

// Mongoose pre-save hook to hash the password before saving a user document.
// This function runs automatically before any 'save' operation on a User document.
userSchema.pre('save', async function (next) {
    // 'this' refers to the user document being saved.
    // Only hash the password if it has been modified (or is new).
    // This prevents re-hashing an already hashed password on subsequent saves if the password wasn't changed.
    if (!this.isModified('password')) return next(); // Important: Use return next() to exit if password not modified.

    try {
        // Generate a salt with a cost factor of 10.
        const salt = await bcrypt.genSalt(10);
        // Hash the plain text password with the generated salt.
        this.password = await bcrypt.hash(this.password, salt);
        // Proceed to the next step in the save process.
        next();
    } catch (error) {
        // If an error occurs during hashing, pass it to Mongoose to handle.
        next(error);
    }
});

// Creates the Mongoose model named 'User' using the defined schema.
// The third argument 'users' explicitly sets the collection name in MongoDB.
const User = mongoose.model('User', userSchema, 'users');

module.exports = User;

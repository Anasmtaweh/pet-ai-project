const mongoose = require('mongoose');

// Defines the schema for password reset tokens.
// These tokens are temporary and are used to verify a user's identity
// when they request to reset their password.
const passwordResetTokenSchema = new mongoose.Schema({
    // Stores the ID of the user who initiated the password reset request.
    // This links the token back to a specific user account.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User', // Establishes a reference to the 'User' model.
    },
    // The actual unique token string generated for the password reset process.
    token: {
        type: String,
        required: true,
    },
    // Timestamp indicating when the token was created.
    // MongoDB will automatically delete this document after the specified 'expires' duration
    // due to the TTL (Time-To-Live) index created by this option.
    createdAt: {
        type: Date,
        default: Date.now, // Defaults to the current date and time when the token is created.
        expires: 3600, // Token expires in 1 hour (adjustable)
    },
});

// Creates the Mongoose model named 'PasswordResetToken' using the defined schema.
// This model will be used to interact with the 'passwordresettokens' collection in MongoDB.
const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

module.exports = PasswordResetToken;

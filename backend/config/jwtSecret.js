// Imports the application's configuration, which loads environment variables.
const config = require('./config');

// Validate that the JWT_SECRET was actually loaded from the environment via config.js.
// This is a critical check to ensure the application doesn't start without a JWT secret,
// which is essential for secure token generation and verification.
if (!config.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables. Application cannot start securely.");
    process.exit(1); // Exit if the secret is missing, preventing insecure operation.
}

// Exports the JWT secret for use in token-related operations throughout the application.
module.exports = {
    secret: config.JWT_SECRET // Export the secret read from the environment.
};


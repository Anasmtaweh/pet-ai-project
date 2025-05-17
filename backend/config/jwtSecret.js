//  c:\Users\Anas\M5\pet-ai-project\backend\config\jwtSecret.js

const config = require('./config'); 

// Validate that the JWT_SECRET was actually loaded from the environment via config.js
if (!config.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1); // Exit if the secret is missing
}

module.exports = {
    secret: config.JWT_SECRET // Export the secret read from the environment
};

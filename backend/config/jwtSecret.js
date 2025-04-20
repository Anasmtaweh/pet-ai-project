// backend/config/jwtSecret.js
const config = require('./config'); // Adjust path if needed

if (!config.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1); // Exit if secret is missing
}

module.exports = {
    secret: config.JWT_SECRET
};

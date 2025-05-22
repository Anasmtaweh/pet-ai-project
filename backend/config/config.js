// Loads environment variables from a .env file into process.env, primarily for local development.
// Ensure .env is in .gitignore to prevent committing sensitive credentials.
require('dotenv').config();

// Helper function to read an environment variable, trim whitespace, and provide a default value if not set or empty.
const getEnv = (key, defaultValue = undefined) => {
    const value = process.env[key];
    if (value !== undefined) {
        const trimmedValue = value.trim();
        // If trimmedValue is not empty, return it.
        // If trimmedValue is empty, it's considered "not set enough", so use defaultValue.
        return trimmedValue || defaultValue;
    }
    return defaultValue;
};

// --- Critical Configurations - Application will exit if these are not set ---
// Database connection URL. Essential for application operation.
const DB_URL = getEnv('DB_URL');
if (!DB_URL) {
    console.error("FATAL ERROR: DB_URL is not defined in environment variables. Please set it in your .env file or environment.");
    process.exit(1); // Exit if the database URL is not configured.
}

// Secret key for signing and verifying JSON Web Tokens (JWTs). Essential for authentication.
const JWT_SECRET = getEnv('JWT_SECRET');
if (!JWT_SECRET) {
    // This check is also present in jwtSecret.js, but having it early ensures critical config is validated.
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables. Please set it in your .env file or environment.");
    process.exit(1); // Exit if the JWT secret is not configured.
}

// --- Configurations for Optional Features - Application may run with degraded functionality if these are not set ---
// Credentials for the email sending service.
const EMAIL_USER = getEnv('EMAIL_USER');
const EMAIL_PASS = getEnv('EMAIL_PASS');
// API key for OpenAI services.
const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');

// AWS credentials and configuration for S3 and other AWS services.
const AWS_ACCESS_KEY_ID = getEnv('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = getEnv('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = getEnv('AWS_REGION');
const S3_BUCKET_NAME = getEnv('S3_BUCKET_NAME');

// Log warnings if optional feature configurations are missing.
if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS is not set. Email functionality will be disabled.");
}
if (!OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY is not set. AI Chat functionality will be disabled.");
}
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    console.warn("WARNING: One or more AWS configuration variables (ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, S3_BUCKET_NAME) are missing. S3 related features (e.g., pet image uploads) might not work.");
}

// Export all configured variables for use throughout the application.
module.exports = {
    DB_URL: DB_URL,
    JWT_SECRET: JWT_SECRET,

    EMAIL_USER: EMAIL_USER,
    EMAIL_PASS: EMAIL_PASS,
    openaiApiKey: OPENAI_API_KEY,

    aws: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        region: AWS_REGION,
        s3BucketName: S3_BUCKET_NAME,
    }
};

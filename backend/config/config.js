// c:\Users\Anas\M5\pet-ai-project\backend\config\config.js
require('dotenv').config(); // Load .env file for local development (ensure .env is in .gitignore)

// Helper function to read and trim env var, using fallback if necessary
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

// --- Critical Configurations - Application will exit if not set ---
const DB_URL = getEnv('DB_URL');
if (!DB_URL) {
    console.error("FATAL ERROR: DB_URL is not defined in environment variables. Please set it in your .env file or environment.");
    process.exit(1);
}

const JWT_SECRET = getEnv('JWT_SECRET');
if (!JWT_SECRET) {
    // This check is also in jwtSecret.js, but good to have it early.
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables. Please set it in your .env file or environment.");
    process.exit(1);
}

// --- Configurations for Features - App may run with degraded functionality if not set ---
const EMAIL_USER = getEnv('EMAIL_USER');
const EMAIL_PASS = getEnv('EMAIL_PASS');
const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');

const AWS_ACCESS_KEY_ID = getEnv('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = getEnv('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = getEnv('AWS_REGION');
const S3_BUCKET_NAME = getEnv('S3_BUCKET_NAME');


if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS is not set. Email functionality will be disabled.");
}
if (!OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY is not set. AI Chat functionality will be disabled.");
}
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    console.warn("WARNING: One or more AWS configuration variables (ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, S3_BUCKET_NAME) are missing. S3 related features (e.g., pet image uploads) might not work.");
}

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


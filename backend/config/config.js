// c:\Users\Anas\M5\pet-ai-project\backend\config\config.js

// Fallbacks (Consider removing sensitive defaults from committed code)
const DB_URL_DEFAULT = 'mongodb+srv://anas:BLACKDEVIL69@petmanagment.dyd4r.mongodb.net/petManagementDB?retryWrites=true&w=majority&appName=PETMANAGMENT';
const EMAIL_USER_DEFAULT = 'anasanasmtaweh@gmail.com';
const EMAIL_PASS_DEFAULT = 'rqxv xbug alvy jxxx';

// Helper function to read and trim env var, using fallback if necessary
// Note: If env var exists but is only whitespace, trim() makes it "", potentially bypassing fallback.
// This is usually acceptable as whitespace-only values are typically invalid anyway.
const getEnv = (key, defaultValue = undefined) => {
    return process.env[key]?.trim() || defaultValue;
};


module.exports = {
    // Use helper function for trimming and fallback
    DB_URL: getEnv('DB_URL', DB_URL_DEFAULT),
    EMAIL_USER: getEnv('EMAIL_USER', EMAIL_USER_DEFAULT),
    EMAIL_PASS: getEnv('EMAIL_PASS', EMAIL_PASS_DEFAULT),
    openaiApiKey: getEnv('OPENAI_API_KEY'), // Already trimmed via getEnv

    JWT_SECRET: getEnv('JWT_SECRET'), // Trim JWT Secret

    aws: {
        accessKeyId: getEnv('AWS_ACCESS_KEY_ID'), // Trim Access Key
        secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY'), // Trim Secret Key
        region: getEnv('AWS_REGION'), // Trim Region (less critical but consistent)
        s3BucketName: getEnv('S3_BUCKET_NAME'), // Trim Bucket Name
    }
};

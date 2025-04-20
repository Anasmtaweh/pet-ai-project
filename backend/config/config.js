const DB_URL = process.env.DB_URL ;
const EMAIL_USER = process.env.EMAIL_USER ;
const EMAIL_PASS = process.env.EMAIL_PASS ;
const JWT_SECRET = process.env.JWT_SECRET; // <-- Add this

module.exports = {
    DB_URL,
    EMAIL_USER,
    EMAIL_PASS,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim(),
    // --- Add AWS Config ---
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        s3BucketName: process.env.S3_BUCKET_NAME,
    }
    // --- End Add ---
};

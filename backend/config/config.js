const DB_URL_DEFAULT = 'mongodb+srv://anas:BLACKDEVIL69@petmanagment.dyd4r.mongodb.net/petManagementDB?retryWrites=true&w=majority&appName=PETMANAGMENT';
const EMAIL_USER_DEFAULT = 'anasanasmtaweh@gmail.com';
const EMAIL_PASS_DEFAULT = 'rqxv xbug alvy jxxx'; // Consider removing default sensitive values

module.exports = {
    // Use environment variable if available, otherwise fallback (though fallback might be removed for secrets)
    DB_URL: process.env.DB_URL || DB_URL_DEFAULT,
    EMAIL_USER: process.env.EMAIL_USER || EMAIL_USER_DEFAULT,
    EMAIL_PASS: process.env.EMAIL_PASS || EMAIL_PASS_DEFAULT,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim(),

    // Add AWS configuration structure, reading from environment variables
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        s3BucketName: process.env.S3_BUCKET_NAME,
    }
};

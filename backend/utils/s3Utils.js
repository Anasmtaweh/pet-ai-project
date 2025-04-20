// backend/utils/s3Utils.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config'); // Make sure path is correct

// Basic check for configuration
if (!config.aws.region || !config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.s3BucketName) {
    console.error("FATAL ERROR: AWS S3 configuration is missing in environment variables.");
    // Optionally, throw an error to prevent the app from starting without config
    // throw new Error("AWS S3 configuration is missing.");
}

// Configure the S3 client
const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    }
});

const BUCKET_NAME = config.aws.s3BucketName;

/**
 * Uploads a file buffer to S3.
 */
const uploadFileToS3 = async (fileBuffer, originalname, mimetype) => {
    const fileExtension = originalname.split('.').pop();
    const uniqueKey = `pets/${uuidv4()}.${fileExtension}`; // Store in a 'pets' folder

    const params = {
        Bucket: BUCKET_NAME,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: mimetype,
        ACL: 'public-read' // Make file publicly readable
    };

    try {
        await s3Client.send(new PutObjectCommand(params));
        const url = `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${uniqueKey}`;
        console.log(`Successfully uploaded ${uniqueKey} to S3. URL: ${url}`);
        return url;
    } catch (error) {
        console.error(`Error uploading ${originalname} to S3:`, error);
        throw new Error(`S3 Upload Failed for ${originalname}`); // Re-throw specific error
    }
};

/**
 * Deletes multiple objects from S3 based on their URLs.
 */
const deleteFilesFromS3 = async (urls) => {
    if (!urls || urls.length === 0) return;

    const objectsToDelete = urls.map(url => {
        try {
            const urlParts = new URL(url);
            const key = decodeURIComponent(urlParts.pathname.substring(1)); // Decode URI component
            if (!key) return null;
            return { Key: key };
        } catch (e) {
            console.warn(`Invalid S3 URL format, cannot extract key: ${url}`);
            return null;
        }
    }).filter(Boolean); // Filter out nulls

    if (objectsToDelete.length === 0) return;

    const params = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: objectsToDelete, Quiet: false }
    };

    try {
        const command = new DeleteObjectsCommand(params);
        const data = await s3Client.send(command);
        console.log(`S3 Delete Result for ${objectsToDelete.length} objects:`, data.Deleted?.length || 0, "deleted,", data.Errors?.length || 0, "errors.");
        if (data.Errors && data.Errors.length > 0) {
            console.error("Errors deleting some S3 objects:", data.Errors);
        }
    } catch (error) {
        console.error("Error sending delete command to S3:", error);
        // Decide if this error should stop the overall process (e.g., pet deletion)
    }
};

module.exports = { uploadFileToS3, deleteFilesFromS3 };

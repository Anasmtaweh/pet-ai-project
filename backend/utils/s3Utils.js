// Utility module for interacting with AWS S3 for file storage.
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const config = require('../config/config'); // Loads application configuration, including AWS credentials.

// Validate essential S3 configuration during application startup.
// If critical S3 configuration is missing, an error is logged.
// Note: The application currently does not exit here, but dependent features might fail.
if (!config.aws.region || !config.aws.s3BucketName || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.error("FATAL ERROR: AWS S3 configuration (region, bucket name, access key, secret key) is missing in environment variables.");
    // Consider whether the application should exit if S3 is critical for core functionality.
    // process.exit(1);
}

// Initialize the AWS S3 client with the region specified in the configuration.
// Credentials (accessKeyId and secretAccessKey) are typically loaded automatically by the AWS SDK
// from environment variables or other standard AWS credential providers if not explicitly passed here.
const s3Client = new S3Client({
    region: config.aws.region,
});

/**
 * Uploads a file buffer to the configured S3 bucket.
 * @param {object} params - Parameters for the S3 upload.
 * @param {Buffer} params.fileBuffer - The buffer containing the file data.
 * @param {string} params.fileName - The desired key (path/filename) for the file in S3.
 * @param {string} params.mimetype - The MIME type of the file (e.g., 'image/jpeg').
 * @returns {Promise<{key: string, url: string}>} A promise that resolves to an object containing the S3 key and URL of the uploaded file.
 * @throws {Error} Throws an error if the S3 bucket name is not configured or if the S3 upload fails.
 */
const uploadFileToS3 = async ({ fileBuffer, fileName, mimetype }) => {
    const bucketName = config.aws.s3BucketName;

    // Ensure the S3 bucket name is configured before attempting to upload.
    if (!bucketName) {
        console.error("S3 Upload Error: Bucket name is missing in configuration.");
        throw new Error("S3 bucket name configuration is missing.");
    }

    // Define the parameters for the S3 PutObjectCommand.
    const uploadParams = {
        Bucket: bucketName,       // The name of the S3 bucket.
        Key: fileName,            // The key (path and filename) under which to store the file in S3.
        Body: fileBuffer,         // The file data as a buffer.
        ContentType: mimetype,    // The MIME type of the file.
        // ACL: 'public-read',    // Uncomment if objects should be publicly readable by default.
                                  // Ensure bucket policies are also configured appropriately for public access.
    };

    try {
        // Log the upload attempt for debugging.
        console.log(`Attempting to upload to S3: Bucket=${uploadParams.Bucket}, Key=${uploadParams.Key}`);
        // Create a new PutObjectCommand with the upload parameters.
        const command = new PutObjectCommand(uploadParams);
        // Send the command to the S3 client to perform the upload.
        await s3Client.send(command);

        // Construct the public URL of the uploaded file.
        const fileUrl = `https://${bucketName}.s3.${config.aws.region}.amazonaws.com/${uploadParams.Key}`;
        console.log(`Successfully uploaded ${fileName} to ${fileUrl}`);
        // Return an object containing the S3 key and the public URL of the file.
        return { key: uploadParams.Key, url: fileUrl };
    } catch (err) {
        // Log the detailed error if the S3 upload fails.
        console.error("Error uploading file to S3:", err);
        // Re-throw the error to be handled by the calling route or service.
        throw err;
    }
};


/**
 * Deletes a file from the configured S3 bucket using its key.
 * @param {string} fileKey - The key (path/filename) of the file to delete from S3.
 * @returns {Promise<void>} A promise that resolves when the deletion is attempted.
 *                          Does not throw an error on S3 deletion failure by default, but logs it.
 */
const deleteFileFromS3 = async (fileKey) => {
     const bucketName = config.aws.s3BucketName;
     // If the bucket name is not configured, log an error and return.
     // This prevents attempts to delete from a non-existent or unconfigured bucket.
     if (!bucketName) {
        console.error("S3 Delete Error: Bucket name is missing in configuration.");
        // Decide if you want to throw an error or just log and return.
        // Current implementation logs and returns, allowing the application to proceed.
        return;
     }
     // Define the parameters for the S3 DeleteObjectCommand.
     const deleteParams = {
         Bucket: bucketName, // The name of the S3 bucket.
         Key: fileKey,       // The key of the file to be deleted.
     };
     try {
         // Create a new DeleteObjectCommand with the delete parameters.
         const command = new DeleteObjectCommand(deleteParams);
         // Send the command to the S3 client to perform the deletion.
         await s3Client.send(command);
         console.log(`Successfully deleted ${fileKey} from S3`);
     } catch (err) {
         // Log any errors that occur during the S3 deletion process.
         console.error(`Error deleting file ${fileKey} from S3:`, err);
         
     }
};

// Export the S3 client and utility functions for use in other parts of the application.
module.exports = {
    s3Client, // Exporting the client itself might be useful for more advanced S3 operations elsewhere.
    uploadFileToS3,
    deleteFileFromS3,
};

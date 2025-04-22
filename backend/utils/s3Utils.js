// c:\Users\Anas\M5\pet-ai-project\backend\utils\s3Utils.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner"); // Still commented out - not needed for this fix
const config = require('../config/config');

// Validate essential S3 configuration
if (!config.aws.region || !config.aws.s3BucketName || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.error("FATAL ERROR: AWS S3 configuration (region, bucket name, access key, secret key) is missing in environment variables.");
    // Depending on how critical S3 is, you might exit or throw an error
    // process.exit(1); // Uncomment to make it fatal if S3 is absolutely required for startup
}

// Create an S3 client instance
// Credentials will be automatically sourced from environment variables if available,
// or from IAM role if running on EC2 with a role attached.
const s3Client = new S3Client({
    region: config.aws.region,
});

// --- MODIFIED: Removed acl parameter and ACL line ---
// Function to upload a file buffer to S3
const uploadFileToS3 = async ({ fileBuffer, fileName, mimetype }) => {
    const bucketName = config.aws.s3BucketName;

    // Ensure bucketName is valid before proceeding
    if (!bucketName) {
        console.error("S3 Upload Error: Bucket name is missing in configuration.");
        throw new Error("S3 bucket name configuration is missing.");
    }

    const uploadParams = {
        Bucket: bucketName,
        Key: fileName, // Use the full key passed from the route (e.g., uploads/pets/unique_id.png)
        Body: fileBuffer,
        ContentType: mimetype,
        // ACL: acl, // <-- REMOVED THIS LINE - Bucket does not allow ACLs
    };

    try {
        console.log(`Attempting to upload to S3: Bucket=${uploadParams.Bucket}, Key=${uploadParams.Key}`);
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Construct the public URL (requires Bucket Policy for public access)
        // Format: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
        const fileUrl = `https://${bucketName}.s3.${config.aws.region}.amazonaws.com/${uploadParams.Key}`;
        console.log(`Successfully uploaded ${fileName} to ${fileUrl}`);
        return { key: uploadParams.Key, url: fileUrl }; // Return both key and URL
    } catch (err) {
        console.error("Error uploading file to S3:", err); // Log the detailed error
        throw err; // Re-throw error to be handled by the route
    }
};
// --- END MODIFICATION ---

// Optional: Function to delete a file from S3 (using the Key)
const deleteFileFromS3 = async (fileKey) => {
     const bucketName = config.aws.s3BucketName;
     if (!bucketName) {
        console.error("S3 Delete Error: Bucket name is missing in configuration.");
        // Decide if you want to throw or just log
        return;
     }
     const deleteParams = {
         Bucket: bucketName,
         Key: fileKey,
     };
     try {
         const command = new DeleteObjectCommand(deleteParams);
         await s3Client.send(command);
         console.log(`Successfully deleted ${fileKey} from S3`);
     } catch (err) {
         console.error(`Error deleting file ${fileKey} from S3:`, err);
         // Decide if you want to throw or just log the error
     }
};

module.exports = {
    s3Client, // Export client if needed elsewhere, otherwise optional
    uploadFileToS3,
    deleteFileFromS3,
};

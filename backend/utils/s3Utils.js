// c:\Users\Anas\M5\pet-ai-project\backend\utils\s3Utils.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner"); // Might need later for private files
const config = require('../config/config');

// Validate essential S3 configuration
if (!config.aws.region || !config.aws.s3BucketName || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.error("FATAL ERROR: AWS S3 configuration (region, bucket name, access key, secret key) is missing in environment variables.");
    // Depending on how critical S3 is, you might exit or throw an error
    // process.exit(1); // Uncomment to make it fatal
}

// Create an S3 client instance
// Credentials will be automatically sourced from environment variables:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (implicitly used)
const s3Client = new S3Client({
    region: config.aws.region,
});

// Function to upload a file buffer to S3
// ACL='public-read' makes the uploaded file publicly accessible via its URL
// Modify ACL or remove it if you want private files
const uploadFileToS3 = async ({ fileBuffer, fileName, mimetype, acl = 'public-read' }) => {
    const bucketName = config.aws.s3BucketName;
    const uploadParams = {
        Bucket: bucketName,
        Key: `uploads/${Date.now()}_${fileName}`, // Example key structure: uploads/timestamp_filename.ext
        Body: fileBuffer,
        ContentType: mimetype,
        ACL: acl, // Set object ACL (e.g., public-read)
    };

    try {
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);
        // Construct the public URL (adjust if your bucket/region setup differs or if using CloudFront)
        const fileUrl = `https://${bucketName}.s3.${config.aws.region}.amazonaws.com/${uploadParams.Key}`;
        console.log(`Successfully uploaded ${fileName} to ${fileUrl}`);
        return { key: uploadParams.Key, url: fileUrl }; // Return both key and URL
    } catch (err) {
        console.error("Error uploading file to S3:", err);
        throw err; // Re-throw error to be handled by the route
    }
};

// Optional: Function to delete a file from S3 (using the Key)
const deleteFileFromS3 = async (fileKey) => {
     const bucketName = config.aws.s3BucketName;
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


// Optional: Function to generate presigned GET URL for private files
// const getPresignedGetUrl = async (fileKey, expiresIn = 3600) => { // Default 1 hour
//     const bucketName = config.aws.s3BucketName;
//     const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
//     try {
//         const url = await getSignedUrl(s3Client, command, { expiresIn });
//         return url;
//     } catch (err) {
//         console.error(`Error generating presigned GET URL for ${fileKey}:`, err);
//         throw err;
//     }
// };


module.exports = {
    s3Client,
    uploadFileToS3,
    deleteFileFromS3,
    // getPresignedGetUrl // Uncomment if needed
};

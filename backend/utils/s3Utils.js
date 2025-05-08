// c:\Users\Anas\M5\pet-ai-project\backend\utils\s3Utils.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const config = require('../config/config');

// Validate essential S3 configuration
if (!config.aws.region || !config.aws.s3BucketName || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.error("FATAL ERROR: AWS S3 configuration (region, bucket name, access key, secret key) is missing in environment variables.");
    
}


const s3Client = new S3Client({
    region: config.aws.region,
});

const uploadFileToS3 = async ({ fileBuffer, fileName, mimetype }) => {
    const bucketName = config.aws.s3BucketName;

    // Ensure bucketName is valid before proceeding
    if (!bucketName) {
        console.error("S3 Upload Error: Bucket name is missing in configuration.");
        throw new Error("S3 bucket name configuration is missing.");
    }

    const uploadParams = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimetype,
        
    };

    try {
        console.log(`Attempting to upload to S3: Bucket=${uploadParams.Bucket}, Key=${uploadParams.Key}`);
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        const fileUrl = `https://${bucketName}.s3.${config.aws.region}.amazonaws.com/${uploadParams.Key}`;
        console.log(`Successfully uploaded ${fileName} to ${fileUrl}`);
        return { key: uploadParams.Key, url: fileUrl }; // Return both key and URL
    } catch (err) {
        console.error("Error uploading file to S3:", err); // Log the detailed error
        throw err; // Re-throw error to be handled by the route
    }
};


//  Function to delete a file from S3 (using the Key)
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

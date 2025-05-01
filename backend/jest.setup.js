// jest.setup.js
require('dotenv').config(); // Keep this

// Add dummy AWS credentials for testing
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'testAccessKeyId';
process.env.AWS_SECRET_ACCESS_KEY = 'testSecretAccessKey';
// Add any other required AWS vars if needed


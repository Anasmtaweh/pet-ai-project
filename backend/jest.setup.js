// c:\Users\Anas\Desktop\backend\jest.setup.js
require('dotenv').config(); // Keep this

// Add dummy AWS credentials for testing
// These are needed because some files (like s3Utils) might check for these
// variables during initialization, even if the functions are mocked later.
// Using dummy values prevents Jest from crashing before tests can run.
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'testAccessKeyId';
process.env.AWS_SECRET_ACCESS_KEY = 'testSecretAccessKey';

// Add dummy JWT secret if not already set by dotenv, as middleware/routes might need it
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-from-jest-setup';

// Add dummy Email creds if not set, as mailer might need them at init
process.env.EMAIL_USER = process.env.EMAIL_USER || 'test@example.com';
process.env.EMAIL_PASS = process.env.EMAIL_PASS || 'testpass';

// Add dummy OpenAI key if not set
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

// Add dummy DB_URL if not set (though tests use MongoMemoryServer)
process.env.DB_URL = process.env.DB_URL || 'mongodb://localhost:27017/testdb_jest';

// Add any other required environment variables your application checks
// during initialization below, using dummy values.
// Example:
// process.env.SOME_OTHER_API_KEY = process.env.SOME_OTHER_API_KEY || 'dummy-key';

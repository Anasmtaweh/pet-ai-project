// c:\Users\Anas\Desktop\backend\__tests__\routes\auth.test.js

// --- START TEMPORARY DIAGNOSTIC ---
// Force set environment variables here to ensure they exist before server import
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-from-auth-test'; // Ensure JWT is also set
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'testAccessKeyId';
process.env.AWS_SECRET_ACCESS_KEY = 'testSecretAccessKey';
// --- END TEMPORARY DIAGNOSTIC ---

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import app from the destructured export
const User = require('../../models/User');
const PasswordResetToken = require('../../models/PasswordResetToken');
// const jwtSecret = require('../../config/jwtSecret'); // Secret is loaded via process.env now

// Mock mailer to prevent actual email sending
jest.mock('../../utils/mailer', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// --- MongoDB In-Memory Server Setup ---
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  // Ensure Mongoose uses the in-memory server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear collections before each test for isolation
  await User.deleteMany({});
  await PasswordResetToken.deleteMany({});
  // Clear any spies/mocks if they aren't reset elsewhere
  jest.clearAllMocks();
});
// --- End DB Setup ---


// --- Integration Tests using Supertest ---
describe('Auth Routes', () => {

  describe('POST /auth/signup', () => {
    it('should create new user with valid data', async () => {
      const response = await request(app) // Use the imported app
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'ValidPass123!',
          username: 'testuser',
          age: 25
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('User created successfully');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');

      // Verify user in DB
      const dbUser = await User.findOne({ email: 'test@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.username).toBe('testuser');
      // Check if password was hashed (it shouldn't be the plain text)
      expect(dbUser.password).not.toBe('ValidPass123!');
    });

    it('should return 400 for existing email', async () => {
       // Create a user first using the actual model
       const existingUser = new User({ email: 'test@example.com', password: 'SomePassword1!', username: 'existing', age: 30 });
       await existingUser.save(); // Let mongoose handle hashing etc.

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com', // Same email
          password: 'ValidPass123!',
          username: 'testuser',
          age: 25
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('User already exists');
    });

     // Add more tests: missing fields, invalid email/password formats etc.
     it('should return 400 for missing email', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ /* email missing */ password: 'ValidPass123!', username: 'testuser', age: 25 });
        expect(response.statusCode).toBe(400);
        // Add assertion for specific error message if your validation provides one
     });
  });


  describe('POST /auth/login', () => {
    // Use a variable to hold the user created in beforeEach
    let testUser;
    beforeEach(async () => {
        // Create a user to login with before each login test
        testUser = new User({
            // _id: '123', // Let MongoDB generate the ID
            email: 'test@example.com',
            password: 'ValidPass123!', // Password will be hashed by pre-save hook
            username: 'testuser',
            age: 30,
            isActive: true
        });
        await testUser.save(); // Ensure pre-save hook runs and password gets hashed
    });

    it('should return token for valid credentials', async () => {
      // SPY STRATEGY (as you had before):
      const compareSpy = jest.spyOn(bcrypt, 'compare');
      compareSpy.mockResolvedValue(true); // Force compare to return true

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' }); // Use the plain password

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Logged in successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.role).toBe('user');
      expect(response.body.isActive).toBe(true);

      compareSpy.mockRestore(); // Clean up the spy


    });

    it('should return 400 for invalid password', async () => {
        // SPY STRATEGY:
        const compareSpy = jest.spyOn(bcrypt, 'compare');
        compareSpy.mockResolvedValue(false); // Force compare to return false

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'WrongPassword!' });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Invalid credentials');

        compareSpy.mockRestore();

    });

     it('should return 400 for non-existent email', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'nosuchuser@example.com', password: 'password' });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Invalid credentials');
    });

     it('should return 403 for inactive user', async () => {
        // Update the previously created user to be inactive
        await User.updateOne({ email: testUser.email }, { isActive: false });

        // SPY STRATEGY:
        const compareSpy = jest.spyOn(bcrypt, 'compare');
        compareSpy.mockResolvedValue(true); // Assume password is correct for this test

        const response = await request(app)
            .post('/auth/login')
            .send({ email: testUser.email, password: 'ValidPass123!' });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe('Your account is inactive. Please contact support.');

        compareSpy.mockRestore();

    });
  });



});

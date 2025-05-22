// This block temporarily sets environment variables.
// It's included to ensure these crucial variables exist before the server (and its configurations) are imported,
// which can be helpful for isolating tests or diagnosing environment-specific issues.
// Ensure JWT_SECRET is also set for token operations.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-from-auth-test';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'testAccessKeyId';
process.env.AWS_SECRET_ACCESS_KEY = 'testSecretAccessKey';

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import app from the destructured export
const User = require('../../models/User');
const PasswordResetToken = require('../../models/PasswordResetToken');
// jwtSecret is loaded via process.env by the application, so direct import isn't strictly needed here if process.env.JWT_SECRET is set.

// Mock the mailer utility to prevent actual email sending during tests.
jest.mock('../../utils/mailer', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

let mongoServer;

// Setup for the test environment: runs once before all tests in this file.
beforeAll(async () => {
  // Start an in-memory MongoDB server for isolated testing.
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  // Ensure Mongoose uses the in-memory server for all database operations.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

// Teardown for the test environment: runs once after all tests in this file.
afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory MongoDB server to free resources.
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Runs before each individual test case in this file.
beforeEach(async () => {
  // Clear relevant collections before each test to ensure test isolation and a clean state.
  await User.deleteMany({});
  await PasswordResetToken.deleteMany({});
  // Clear any spies or mocks to prevent interference between tests.
  jest.clearAllMocks();
});

// Test suite for authentication-related routes (e.g., signup, login).
describe('Auth Routes', () => {

  // Test suite for the POST /auth/signup endpoint.
  describe('POST /auth/signup', () => {
    // Test case: Verifies successful user creation with valid input data.
    it('should create new user with valid data', async () => {
      const response = await request(app) // Use the imported Express app
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

      // Verify that the user was actually created in the database.
      const dbUser = await User.findOne({ email: 'test@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.username).toBe('testuser');
      // Check if the password was hashed and is not stored in plain text.
      expect(dbUser.password).not.toBe('ValidPass123!');
    });

    // Test case: Verifies that the system prevents signup with an already existing email.
    it('should return 400 for existing email', async () => {
       // Create a user first using the actual Mongoose model to simulate an existing user.
       const existingUser = new User({ email: 'test@example.com', password: 'SomePassword1!', username: 'existing', age: 30 });
       await existingUser.save(); // Let Mongoose handle hashing and other pre-save hooks.

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com', // Attempt to sign up with the same email.
          password: 'ValidPass123!',
          username: 'testuser',
          age: 25
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('User already exists');
    });

     // Test case: Verifies that signup fails if required fields (like email) are missing.
     // Consider adding more tests for other missing fields and invalid email/password formats.
     it('should return 400 for missing email', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ /* email is intentionally missing */ password: 'ValidPass123!', username: 'testuser', age: 25 });
        expect(response.statusCode).toBe(400);
        // Optionally, add an assertion for a specific error message if your validation provides one.
     });
  });

  // Test suite for the POST /auth/login endpoint.
  describe('POST /auth/login', () => {
    // A variable to hold the user created in the beforeEach hook for login tests.
    let testUser;
    beforeEach(async () => {
        // Create a user to attempt login with before each login test.
        testUser = new User({
            email: 'test@example.com',
            password: 'ValidPass123!', // Password will be hashed by the User model's pre-save hook.
            username: 'testuser',
            age: 30,
            isActive: true
        });
        await testUser.save(); // Ensure pre-save hook runs and password gets hashed.
    });

    // Test case: Verifies successful login and token generation for valid credentials.
    it('should return token for valid credentials', async () => {
      // Using a spy to control the bcrypt.compare behavior for this test.
      const compareSpy = jest.spyOn(bcrypt, 'compare');
      compareSpy.mockResolvedValue(true); // Force bcrypt.compare to return true, simulating a correct password.

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' }); // Use the plain password for the request.

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Logged in successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.role).toBe('user');
      expect(response.body.isActive).toBe(true);

      compareSpy.mockRestore(); // Clean up the spy after the test.
    });

    // Test case: Verifies that login fails with an invalid password.
    it('should return 400 for invalid password', async () => {
        // Using a spy to control the bcrypt.compare behavior.
        const compareSpy = jest.spyOn(bcrypt, 'compare');
        compareSpy.mockResolvedValue(false); // Force bcrypt.compare to return false, simulating an incorrect password.

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'WrongPassword!' });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Invalid credentials');

        compareSpy.mockRestore(); // Clean up the spy.
    });

    // Test case: Verifies that login fails if the provided email does not exist in the database.
     it('should return 400 for non-existent email', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'nosuchuser@example.com', password: 'password' });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Invalid credentials');
    });

    // Test case: Verifies that login is forbidden for an inactive user account.
     it('should return 403 for inactive user', async () => {
        // Update the previously created user to be inactive for this test.
        await User.updateOne({ email: testUser.email }, { isActive: false });

        // Using a spy to control bcrypt.compare behavior.
        const compareSpy = jest.spyOn(bcrypt, 'compare');
        compareSpy.mockResolvedValue(true); // Assume password is correct for this test to isolate the isActive check.

        const response = await request(app)
            .post('/auth/login')
            .send({ email: testUser.email, password: 'ValidPass123!' });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe('Your account is inactive. Please contact support.');

        compareSpy.mockRestore(); // Clean up the spy.
    });
  });
});


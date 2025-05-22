const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt'); // Needed to check password hashing
const User = require('../../models/User');

let mongoServer;

// Setup for the test environment: runs once before all tests in this file.
beforeAll(async () => {
  // Start an in-memory MongoDB server for isolated testing.
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  // Disconnect any existing Mongoose connection and connect to the in-memory server.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

// Teardown for the test environment: runs once after all tests in this file.
afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory MongoDB server.
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Runs before each individual test case in this file.
beforeEach(async () => {
  // Clear the User collection to ensure a clean state for each test.
  await User.deleteMany({});
});

// Test suite for the User Mongoose model.
describe('User Model', () => {

  // Helper function to generate valid data for creating a User instance.
  // Allows a suffix for email to easily create unique emails for certain tests.
  const createValidUserData = (emailSuffix = '') => ({
    email: `test${emailSuffix}@example.com`,
    password: 'ValidPassword1!',
    username: 'testuser',
    age: 25,
  });

  // Test case: Verifies that a user can be created and saved successfully with all valid data.
  it('should create and save a user successfully with valid data', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    const savedUser = await user.save();

    // Assertions to check if the saved user's properties match the input data.
    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe(validData.email);
    expect(savedUser.username).toBe(validData.username);
    expect(savedUser.age).toBe(validData.age);
    // Check default values defined in the schema.
    expect(savedUser.role).toBe('user');
    expect(savedUser.isActive).toBe(true);
    // Check that timestamps are automatically added.
    expect(savedUser.createdAt).toBeDefined();
    // Verify that the password was hashed and matches the original.
    expect(savedUser.password).not.toBe(validData.password);
    const isMatch = await bcrypt.compare(validData.password, savedUser.password);
    expect(isMatch).toBe(true);
  });

  // Test case: Verifies that the password is correctly hashed upon saving a new user.
  it('should hash password on save', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    await user.save();

    // Fetch user again from the database to ensure the password stored is hashed.
    const foundUser = await User.findById(user._id);
    expect(foundUser.password).not.toBe(validData.password);
    // A simple check that the hashed password is longer than the plain text one.
    expect(foundUser.password.length).toBeGreaterThan(validData.password.length);
  });

  // Test case: Verifies that the password is NOT re-hashed if it hasn't been modified during an update.
  it('should NOT re-hash password if not modified', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    await user.save();
    const initialHash = user.password; // Store the initial hash.

    // Fetch the user, modify a non-password field, and save again.
    const foundUser = await User.findById(user._id);
    foundUser.username = 'updateduser';
    await foundUser.save();

    // Fetch the user again and check if the password hash remains unchanged.
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.password).toBe(initialHash); // Hash should be the same.
  });

  // Dynamically create test cases to verify that all specified required fields are enforced.
  const requiredFields = ['email', 'password', 'username', 'age'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidUserData();
      delete invalidData[field]; // Remove the current required field.
      const user = new User(invalidData);
      // Expect the save operation to throw a Mongoose ValidationError.
      await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
      // Optionally, verify that the error object specifically mentions the missing field.
      try { await user.save(); } catch (error) { expect(error.errors[field]).toBeDefined(); }
    });
  });

  // Test case: Verifies that the 'email' field must be unique.
  it('should fail to save if email is not unique', async () => {
    const data1 = createValidUserData(); // Uses default email test@example.com
    const data2 = createValidUserData(); // Also uses default email test@example.com

    const user1 = new User(data1);
    await user1.save(); // Save the first user successfully.

    const user2 = new User(data2); // Attempt to save another user with the same email.

    // Expect the save operation to reject due to a duplicate key error (MongoDB E11000).
    await expect(user2.save()).rejects.toThrow(/duplicate key error/i);
  });


  // Test case: Verifies email format validation against a list of invalid email strings.
  it('should fail to save with invalid email format', async () => {
    const invalidEmails = ['plainaddress', '@missinglocalpart.com', 'user@domain.', 'user@.com', 'user@domain.c'];
    for (const email of invalidEmails) {
      const invalidData = { ...createValidUserData(), email: email }; // Use a unique base email to avoid unique constraint issues
      const user = new User(invalidData);
      await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
      try { await user.save(); } catch (error) { expect(error.errors.email).toBeDefined(); }
    }
  });

  // Test case: Verifies password length validation (minimum 8 characters).
  it('should fail to save with password less than 8 characters', async () => {
    const invalidData = { ...createValidUserData('shortpass'), password: 'Short1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test case: Verifies password complexity (must contain an uppercase letter).
  it('should fail to save with password missing uppercase', async () => {
    const invalidData = { ...createValidUserData('noupper'), password: 'nouppercase1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test case: Verifies password complexity (must contain a lowercase letter).
  it('should fail to save with password missing lowercase', async () => {
    const invalidData = { ...createValidUserData('nolower'), password: 'NOLOWERCASE1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test case: Verifies password complexity (must contain a number).
  it('should fail to save with password missing number', async () => {
    const invalidData = { ...createValidUserData('nonumber'), password: 'NoNumberHere!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test case: Verifies password complexity (must contain a special character).
  it('should fail to save with password missing special character', async () => {
    const invalidData = { ...createValidUserData('nospecial'), password: 'NoSpecial123' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test case: Verifies age validation (minimum age of 13).
  it('should fail to save with age less than 13', async () => {
    const invalidData = { ...createValidUserData('young'), age: 12 };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.age).toBeDefined(); }
  });

  // Test case: Verifies age validation (maximum age of 120).
  it('should fail to save with age greater than 120', async () => {
    const invalidData = { ...createValidUserData('old'), age: 121 };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.age).toBeDefined(); }
  });

  // Test case: Verifies that the 'role' field must be one of the predefined enum values.
  it('should fail to save with invalid role', async () => {
    // Use a unique email suffix to avoid conflicts with the unique email constraint.
    const invalidData = { ...createValidUserData('invalidrole'), role: 'guest' }; // 'guest' is not in the enum
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.role).toBeDefined(); }
  });

});


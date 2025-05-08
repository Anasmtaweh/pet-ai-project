// c:\Users\Anas\Desktop\backend\__tests__\models\User.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt'); // Needed to check hashing
const User = require('../../models/User'); 

let mongoServer;

// --- Test Setup ---
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
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
  // Clear the User collection before each test
  await User.deleteMany({});
});
// --- End Test Setup ---


// --- Test Suite ---
describe('User Model', () => {

  // Helper function to create valid user data
  const createValidUserData = (emailSuffix = '') => ({
    email: `test${emailSuffix}@example.com`,
    password: 'ValidPassword1!',
    username: 'testuser',
    age: 25,
  });

  it('should create and save a user successfully with valid data', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    const savedUser = await user.save();

    // Assertions
    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe(validData.email);
    expect(savedUser.username).toBe(validData.username);
    expect(savedUser.age).toBe(validData.age);
    // Check default values
    expect(savedUser.role).toBe('user');
    expect(savedUser.isActive).toBe(true);
    // Check timestamps
    expect(savedUser.createdAt).toBeDefined();
    // Check password was hashed
    expect(savedUser.password).not.toBe(validData.password);
    const isMatch = await bcrypt.compare(validData.password, savedUser.password);
    expect(isMatch).toBe(true);
  });

  it('should hash password on save', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    await user.save();

    // Fetch user again to ensure password in DB is hashed
    const foundUser = await User.findById(user._id);
    expect(foundUser.password).not.toBe(validData.password);
    expect(foundUser.password.length).toBeGreaterThan(validData.password.length); // Basic check for hash
  });

  it('should NOT re-hash password if not modified', async () => {
    const validData = createValidUserData();
    const user = new User(validData);
    await user.save();
    const initialHash = user.password;

    // Fetch, modify username, and save again
    const foundUser = await User.findById(user._id);
    foundUser.username = 'updateduser';
    await foundUser.save();

    // Fetch again and check password hash
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.password).toBe(initialHash); // Hash should be unchanged
  });

  // Test required fields
  const requiredFields = ['email', 'password', 'username', 'age'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidUserData();
      delete invalidData[field];
      const user = new User(invalidData);
      await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
      try { await user.save(); } catch (error) { expect(error.errors[field]).toBeDefined(); }
    });
  });

  // Test unique email
  it('should fail to save if email is not unique', async () => {
    const data1 = createValidUserData();
    const data2 = createValidUserData(); // Same email by default

    const user1 = new User(data1);
    await user1.save(); // Save the first one successfully

    const user2 = new User(data2);

    // Check that saving the second user rejects with an error containing "duplicate key"
    await expect(user2.save()).rejects.toThrow(/duplicate key error/i);
  });
  

  // Test email format validation
  it('should fail to save with invalid email format', async () => {
    const invalidEmails = ['plainaddress', '@missinglocalpart.com', 'user@domain.', 'user@.com', 'user@domain.c'];
    for (const email of invalidEmails) {
      const invalidData = { ...createValidUserData(), email: email };
      const user = new User(invalidData);
      await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
      try { await user.save(); } catch (error) { expect(error.errors.email).toBeDefined(); }
    }
  });

  // Test password validation
  it('should fail to save with password less than 8 characters', async () => {
    const invalidData = { ...createValidUserData(), password: 'Short1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  it('should fail to save with password missing uppercase', async () => {
    const invalidData = { ...createValidUserData(), password: 'nouppercase1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  it('should fail to save with password missing lowercase', async () => {
    const invalidData = { ...createValidUserData(), password: 'NOLOWERCASE1!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  it('should fail to save with password missing number', async () => {
    const invalidData = { ...createValidUserData(), password: 'NoNumberHere!' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  it('should fail to save with password missing special character', async () => {
    const invalidData = { ...createValidUserData(), password: 'NoSpecial123' };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.password).toBeDefined(); }
  });

  // Test age validation
  it('should fail to save with age less than 13', async () => {
    const invalidData = { ...createValidUserData(), age: 12 };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.age).toBeDefined(); }
  });

  it('should fail to save with age greater than 120', async () => {
    const invalidData = { ...createValidUserData(), age: 121 };
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.age).toBeDefined(); }
  });

  // Test role enum
  it('should fail to save with invalid role', async () => {
    const invalidData = { ...createValidUserData('role'), role: 'guest' }; // Use different email
    const user = new User(invalidData);
    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await user.save(); } catch (error) { expect(error.errors.role).toBeDefined(); }
  });

});
// --- End Test Suite ---

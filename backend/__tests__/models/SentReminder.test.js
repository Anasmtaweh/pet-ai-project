const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SentReminder = require('../../models/SentReminder');

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
  // Ensure that indexes (like unique constraints) are built before running tests.
  await SentReminder.syncIndexes();
});

// Teardown for the test environment: runs once after all tests in this file.
afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory MongoDB server.
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Runs after each individual test case in this file.
afterEach(async () => {
  // Clear the SentReminder collection AFTER each test.
  // This ensures indexes (especially unique ones) are not dropped and rebuilt repeatedly,
  // which can be an issue if `beforeEach` is used with `deleteMany` and `syncIndexes`.
  await SentReminder.deleteMany({});
});

// Test suite for the SentReminder Mongoose model.
describe('SentReminder Model', () => {

  // Helper function to generate valid data for creating a SentReminder instance.
  const createValidData = (keySuffix = '1') => ({
    reminderKey: `rule123_${Date.now()}_${keySuffix}`, // Ensure unique key for basic tests
    ruleId: new mongoose.Types.ObjectId(),
    occurrenceStartTime: new Date(),
    recipientEmail: 'test@example.com',
  });

  // Test case: Verifies that a SentReminder can be created and saved successfully with only the required fields.
  it('should create and save a SentReminder successfully with required fields', async () => {
    const validData = { reminderKey: 'uniqueKey_1' }; // Only required field
    const sentReminder = new SentReminder(validData);
    const savedReminder = await sentReminder.save();

    // Assertions
    expect(savedReminder._id).toBeDefined();
    expect(savedReminder.reminderKey).toBe(validData.reminderKey);
    expect(savedReminder.sentAt).toBeDefined(); // Check default value for sentAt
    // Optional fields should be undefined if not provided
    expect(savedReminder.ruleId).toBeUndefined();
    expect(savedReminder.occurrenceStartTime).toBeUndefined();
    expect(savedReminder.recipientEmail).toBeUndefined();
  });

  // Test case: Verifies that a SentReminder can be created and saved successfully with all fields populated.
  it('should create and save a SentReminder with all fields', async () => {
    const fullData = createValidData();
    const sentReminder = new SentReminder(fullData);
    const savedReminder = await sentReminder.save();

    expect(savedReminder._id).toBeDefined();
    expect(savedReminder.reminderKey).toBe(fullData.reminderKey);
    expect(savedReminder.sentAt).toBeDefined();
    expect(savedReminder.ruleId).toEqual(fullData.ruleId);
    expect(savedReminder.occurrenceStartTime).toEqual(fullData.occurrenceStartTime);
    expect(savedReminder.recipientEmail).toBe(fullData.recipientEmail);
  });

  // Test case: Verifies that saving a SentReminder fails if the required 'reminderKey' field is missing.
  it('should fail to save if required field "reminderKey" is missing', async () => {
    const invalidData = { // Missing reminderKey
        ruleId: new mongoose.Types.ObjectId(),
        occurrenceStartTime: new Date(),
        recipientEmail: 'test@example.com',
    };
    const sentReminder = new SentReminder(invalidData);

    // Check that save() rejects with a Mongoose ValidationError.
    await expect(sentReminder.save()).rejects.toThrow(mongoose.Error.ValidationError);

    // More specific check for the field causing the error.
    try {
      await sentReminder.save();
    } catch (error) {
      expect(error.errors.reminderKey).toBeDefined();
      expect(error.errors.reminderKey.message).toMatch(/Path `reminderKey` is required/i);
    }
  });

  // Test case: Verifies that saving a SentReminder fails if the 'reminderKey' is not unique.
  it('should fail to save if "reminderKey" is not unique', async () => {
    const duplicateKey = 'duplicate_key_test';
    const data1 = { reminderKey: duplicateKey };
    const data2 = { reminderKey: duplicateKey }; // Same key

    const reminder1 = new SentReminder(data1);
    await reminder1.save(); // Save the first one successfully

    const reminder2 = new SentReminder(data2);

    // Expect save() to reject due to unique constraint violation (E11000 duplicate key error).
    // The error message might vary slightly depending on MongoDB version.
    await expect(reminder2.save()).rejects.toThrow(/duplicate key error/i);

    // More specific check for the MongoDB error code.
    try {
        await reminder2.save();
    } catch (error) {
        // Check for the MongoDB duplicate key error code (11000).
        expect(error.code).toBe(11000);
    }
  });

  // Test case: Verifies that the 'sentAt' field is automatically set to the current date/time upon saving.
  it('should automatically set the "sentAt" field on save', async () => {
    const validData = { reminderKey: 'uniqueKey_for_sentAt_test' };
    const sentReminder = new SentReminder(validData);
    const savedReminder = await sentReminder.save();

    expect(savedReminder.sentAt).toBeInstanceOf(Date);
    // Check if the date is very recent (e.g., within the last 5 seconds).
    const timeDifference = Date.now() - savedReminder.sentAt.getTime();
    expect(timeDifference).toBeLessThan(5000); // 5000 milliseconds = 5 seconds
    expect(timeDifference).toBeGreaterThanOrEqual(0);
  });

  // Test case: Verifies that a TTL (Time-To-Live) index is correctly configured on the 'sentAt' field.
  it('should have a TTL index configured on "sentAt"', async () => {
    const indexes = await SentReminder.collection.indexes();
    // Find the index where the key is { sentAt: 1 } and expireAfterSeconds is set.
    const ttlIndex = indexes.find(index =>
        index.key && index.key.sentAt === 1 && index.hasOwnProperty('expireAfterSeconds')
    );

    expect(ttlIndex).toBeDefined(); // Check that the TTL index exists.
    // Check if the expireAfterSeconds value matches the schema definition (7200 seconds = 2 hours).
    expect(ttlIndex.expireAfterSeconds).toBe(7200);
  });

});


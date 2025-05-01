// c:\Users\Anas\Desktop\backend\__tests__\models\SentReminder.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SentReminder = require('../../models/SentReminder'); // Adjust path if necessary

let mongoServer;

// --- Test Setup ---
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
  // --- ADD THIS: Ensure indexes are created before tests run ---
  // This is crucial for the unique constraint test to work reliably
  await SentReminder.syncIndexes();
  // --- END ADDITION ---
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// --- MODIFY: Use afterEach for cleanup ---
afterEach(async () => {
  // Clear the SentReminder collection AFTER each test
  // This ensures indexes are not dropped between tests within the same suite
  await SentReminder.deleteMany({});
});

// --- REMOVE beforeEach cleanup ---
// beforeEach(async () => {
//   // Clear the SentReminder collection before each test
//   await SentReminder.deleteMany({});
// });
// --- End Test Setup ---


// --- Test Suite ---
describe('SentReminder Model', () => {

  // Helper function to create valid data
  const createValidData = (keySuffix = '1') => ({
    reminderKey: `rule123_${Date.now()}_${keySuffix}`, // Ensure unique key for basic tests
    ruleId: new mongoose.Types.ObjectId(),
    occurrenceStartTime: new Date(),
    recipientEmail: 'test@example.com',
  });

  it('should create and save a SentReminder successfully with required fields', async () => {
    const validData = { reminderKey: 'uniqueKey_1' }; // Only required field
    const sentReminder = new SentReminder(validData);
    const savedReminder = await sentReminder.save();

    // Assertions
    expect(savedReminder._id).toBeDefined();
    expect(savedReminder.reminderKey).toBe(validData.reminderKey);
    expect(savedReminder.sentAt).toBeDefined(); // Check default value
    // Optional fields should be undefined if not provided
    expect(savedReminder.ruleId).toBeUndefined();
    expect(savedReminder.occurrenceStartTime).toBeUndefined();
    expect(savedReminder.recipientEmail).toBeUndefined();
  });

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

  it('should fail to save if required field "reminderKey" is missing', async () => {
    const invalidData = { // Missing reminderKey
        ruleId: new mongoose.Types.ObjectId(),
        occurrenceStartTime: new Date(),
        recipientEmail: 'test@example.com',
    };
    const sentReminder = new SentReminder(invalidData);

    // Check that save() rejects with a ValidationError
    await expect(sentReminder.save()).rejects.toThrow(mongoose.Error.ValidationError);

    // More specific check for the field causing the error
    try {
      await sentReminder.save();
    } catch (error) {
      expect(error.errors.reminderKey).toBeDefined();
      expect(error.errors.reminderKey.message).toMatch(/Path `reminderKey` is required/i);
    }
  });

  it('should fail to save if "reminderKey" is not unique', async () => {
    const duplicateKey = 'duplicate_key_test';
    const data1 = { reminderKey: duplicateKey };
    const data2 = { reminderKey: duplicateKey }; // Same key

    const reminder1 = new SentReminder(data1);
    await reminder1.save(); // Save the first one successfully

    const reminder2 = new SentReminder(data2);

    // Expect save() to reject due to unique constraint violation (E11000 duplicate key error)
    // The error message might vary slightly depending on MongoDB version
    await expect(reminder2.save()).rejects.toThrow(/duplicate key error/i);

    // More specific check for the error code
    try {
        await reminder2.save();
    } catch (error) {
        // Check for the MongoDB duplicate key error code
        expect(error.code).toBe(11000);
    }
  });

  it('should automatically set the "sentAt" field on save', async () => {
    const validData = { reminderKey: 'uniqueKey_for_sentAt_test' };
    const sentReminder = new SentReminder(validData);
    const savedReminder = await sentReminder.save();

    expect(savedReminder.sentAt).toBeInstanceOf(Date);
    // Check if the date is very recent (e.g., within the last 5 seconds)
    const timeDifference = Date.now() - savedReminder.sentAt.getTime();
    expect(timeDifference).toBeLessThan(5000); // 5000 milliseconds = 5 seconds
    expect(timeDifference).toBeGreaterThanOrEqual(0);
  });

  // Test for TTL index (checks if the index is configured)
  it('should have a TTL index configured on "sentAt"', async () => {
    const indexes = await SentReminder.collection.indexes();
    // Find the index where the key is { sentAt: 1 } and expireAfterSeconds is set
    const ttlIndex = indexes.find(index =>
        index.key && index.key.sentAt === 1 && index.hasOwnProperty('expireAfterSeconds')
    );

    expect(ttlIndex).toBeDefined(); // Check that the index exists
    // Check if the expireAfterSeconds value matches the schema definition (7200 seconds = 2 hours)
    expect(ttlIndex.expireAfterSeconds).toBe(7200);
  });

});
// --- End Test Suite ---

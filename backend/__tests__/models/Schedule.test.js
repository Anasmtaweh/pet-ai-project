// c:\Users\Anas\Desktop\backend\__tests__\models\Schedule.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Schedule = require('../../models/Schedule'); // Adjust path if necessary

let mongoServer;

// --- Test Setup ---
beforeAll(async () => {
  // Start the in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Disconnect any existing connection and connect to the in-memory server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory server
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear the Schedule collection before each test
  await Schedule.deleteMany({});
});
// --- End Test Setup ---


// --- Test Suite ---
describe('Schedule Model', () => {

  // Helper function to create valid schedule data
  const createValidScheduleData = () => ({
    title: 'Morning Meal',
    start: new Date('2024-08-15T08:00:00Z'),
    end: new Date('2024-08-15T08:30:00Z'),
    type: 'meal',
    owner: new mongoose.Types.ObjectId(), // Generate a valid ObjectId for the owner
    // Optional fields will use defaults
  });

  it('should create and save a schedule successfully with valid data', async () => {
    const validData = createValidScheduleData();
    const schedule = new Schedule(validData);
    const savedSchedule = await schedule.save();

    // Assertions
    expect(savedSchedule._id).toBeDefined();
    expect(savedSchedule.title).toBe(validData.title);
    expect(savedSchedule.start).toEqual(validData.start);
    expect(savedSchedule.end).toEqual(validData.end);
    expect(savedSchedule.type).toBe(validData.type);
    expect(savedSchedule.owner).toEqual(validData.owner);
    // Check default values
    expect(savedSchedule.repeat).toBe(false);
    expect(savedSchedule.repeatType).toBe('daily');
    expect(savedSchedule.repeatDays).toEqual([]);
    expect(savedSchedule.exceptionDates).toEqual([]);
    // Check timestamps
    expect(savedSchedule.createdAt).toBeDefined();
    expect(savedSchedule.updatedAt).toBeDefined();
  });

  it('should create and save a repeating schedule', async () => {
    const repeatingData = {
      ...createValidScheduleData(),
      repeat: true,
      repeatType: 'weekly',
      repeatDays: ['Monday', 'Wednesday', 'Friday'],
      exceptionDates: [new Date('2024-08-19T08:00:00Z')] // Example exception
    };
    const schedule = new Schedule(repeatingData);
    const savedSchedule = await schedule.save();

    expect(savedSchedule.repeat).toBe(true);
    expect(savedSchedule.repeatType).toBe('weekly');
    expect(savedSchedule.repeatDays).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(savedSchedule.exceptionDates).toHaveLength(1);
    expect(savedSchedule.exceptionDates[0]).toEqual(repeatingData.exceptionDates[0]);
  });

  it('should trim whitespace from title', async () => {
    const dataWithWhitespace = {
      ...createValidScheduleData(),
      title: '  Evening Walk  ',
      type: 'play', // Change type to avoid duplicate key if running tests fast
    };
    const schedule = new Schedule(dataWithWhitespace);
    const savedSchedule = await schedule.save();

    expect(savedSchedule.title).toBe('Evening Walk');
  });

  // Test required fields
  const requiredFields = ['title', 'start', 'end', 'type', 'owner'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidScheduleData();
      delete invalidData[field]; // Remove the required field
      const schedule = new Schedule(invalidData);

      // Expect save() to reject with a ValidationError
      await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);

      // More specific check (optional):
      try {
        await schedule.save();
      } catch (error) {
        expect(error.errors[field]).toBeDefined();
      }
    });
  });

  // Test enum validation
  it('should fail to save with invalid type', async () => {
    const invalidData = { ...createValidScheduleData(), type: 'grooming' }; // 'grooming' is not in enum
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await schedule.save(); } catch (error) { expect(error.errors.type).toBeDefined(); }
  });

  it('should fail to save with invalid repeatType', async () => {
    // Need repeat: true for repeatType validation to matter beyond default
    const invalidData = { ...createValidScheduleData(), repeat: true, repeatType: 'monthly' }; // 'monthly' is not in enum
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await schedule.save(); } catch (error) { expect(error.errors.repeatType).toBeDefined(); }
  });

  // Test date validation (basic check - Mongoose handles type)
  it('should fail if start date is invalid', async () => {
    const invalidData = { ...createValidScheduleData(), start: 'not-a-date' };
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
     try { await schedule.save(); } catch (error) { expect(error.errors.start).toBeDefined(); }
  });

   it('should fail if end date is invalid', async () => {
    const invalidData = { ...createValidScheduleData(), end: 'invalid-date-string' };
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
     try { await schedule.save(); } catch (error) { expect(error.errors.end).toBeDefined(); }
  });

  // Note: Mongoose doesn't automatically validate start < end unless you add a custom validator.
  // This test assumes no such custom validator exists.
  it('should allow saving if end date is before start date (without custom validator)', async () => {
     const data = {
        ...createValidScheduleData(),
        start: new Date('2024-08-15T10:00:00Z'),
        end: new Date('2024-08-15T09:00:00Z'), // End before start
     };
     const schedule = new Schedule(data);
     await expect(schedule.save()).resolves.toBeDefined(); // Should save successfully
  });

});
// --- End Test Suite ---

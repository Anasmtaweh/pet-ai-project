const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Schedule = require('../../models/Schedule');

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
  // Clear the Schedule collection to ensure a clean state for each test.
  await Schedule.deleteMany({});
});

// Test suite for the Schedule Mongoose model.
describe('Schedule Model', () => {

  // Helper function to generate valid data for creating a Schedule instance.
  const createValidScheduleData = () => ({
    title: 'Morning Meal',
    start: new Date('2024-08-15T08:00:00Z'),
    end: new Date('2024-08-15T08:30:00Z'),
    type: 'meal',
    owner: new mongoose.Types.ObjectId(), // Generate a valid ObjectId for the owner
    // Optional fields like 'repeat', 'repeatType', etc., will use schema defaults.
  });

  // Test case: Verifies that a schedule can be created and saved successfully with all valid data.
  it('should create and save a schedule successfully with valid data', async () => {
    const validData = createValidScheduleData();
    const schedule = new Schedule(validData);
    const savedSchedule = await schedule.save();

    // Assertions to check if the saved schedule's properties match the input data.
    expect(savedSchedule._id).toBeDefined();
    expect(savedSchedule.title).toBe(validData.title);
    expect(savedSchedule.start).toEqual(validData.start);
    expect(savedSchedule.end).toEqual(validData.end);
    expect(savedSchedule.type).toBe(validData.type);
    expect(savedSchedule.owner).toEqual(validData.owner);
    // Check default values for optional fields.
    expect(savedSchedule.repeat).toBe(false);
    expect(savedSchedule.repeatType).toBe('daily');
    expect(savedSchedule.repeatDays).toEqual([]);
    expect(savedSchedule.exceptionDates).toEqual([]);
    // Check that timestamps are automatically added.
    expect(savedSchedule.createdAt).toBeDefined();
    expect(savedSchedule.updatedAt).toBeDefined();
  });

  // Test case: Verifies that a repeating schedule with specific repeat rules and exceptions can be saved.
  it('should create and save a repeating schedule', async () => {
    const repeatingData = {
      ...createValidScheduleData(),
      repeat: true,
      repeatType: 'weekly',
      repeatDays: ['Monday', 'Wednesday', 'Friday'],
      exceptionDates: [new Date('2024-08-19T08:00:00Z')] // Example exception date
    };
    const schedule = new Schedule(repeatingData);
    const savedSchedule = await schedule.save();

    expect(savedSchedule.repeat).toBe(true);
    expect(savedSchedule.repeatType).toBe('weekly');
    expect(savedSchedule.repeatDays).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(savedSchedule.exceptionDates).toHaveLength(1);
    expect(savedSchedule.exceptionDates[0]).toEqual(repeatingData.exceptionDates[0]);
  });

  // Test case: Verifies that whitespace is trimmed from the 'title' field.
  it('should trim whitespace from title', async () => {
    const dataWithWhitespace = {
      ...createValidScheduleData(),
      title: '  Evening Walk  ',
      type: 'play', // Using a different type to avoid potential unique index conflicts if tests run very fast
    };
    const schedule = new Schedule(dataWithWhitespace);
    const savedSchedule = await schedule.save();

    expect(savedSchedule.title).toBe('Evening Walk');
  });

  // Dynamically create test cases to verify that all specified required fields are enforced.
  const requiredFields = ['title', 'start', 'end', 'type', 'owner'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidScheduleData();
      delete invalidData[field]; // Remove the current required field
      const schedule = new Schedule(invalidData);

      // Expect the save operation to throw a Mongoose ValidationError.
      await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);

      // Optionally, verify that the error object specifically mentions the missing field.
      try {
        await schedule.save();
      } catch (error) {
        expect(error.errors[field]).toBeDefined();
      }
    });
  });

  // Test cases for enum validation on 'type' and 'repeatType' fields.
  it('should fail to save with invalid type', async () => {
    const invalidData = { ...createValidScheduleData(), type: 'grooming' }; // 'grooming' is not in the defined enum
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await schedule.save(); } catch (error) { expect(error.errors.type).toBeDefined(); }
  });

  it('should fail to save with invalid repeatType when repeat is true', async () => {
    // 'repeatType' validation is primarily relevant when 'repeat' is true.
    const invalidData = { ...createValidScheduleData(), repeat: true, repeatType: 'monthly' }; // 'monthly' is not in the defined enum
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await schedule.save(); } catch (error) { expect(error.errors.repeatType).toBeDefined(); }
  });

  // Test cases for basic date validation (Mongoose handles type casting).
  it('should fail if start date is an invalid date string', async () => {
    const invalidData = { ...createValidScheduleData(), start: 'not-a-date' };
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
     try { await schedule.save(); } catch (error) { expect(error.errors.start).toBeDefined(); }
  });

   it('should fail if end date is an invalid date string', async () => {
    const invalidData = { ...createValidScheduleData(), end: 'invalid-date-string' };
    const schedule = new Schedule(invalidData);
    await expect(schedule.save()).rejects.toThrow(mongoose.Error.ValidationError);
     try { await schedule.save(); } catch (error) { expect(error.errors.end).toBeDefined(); }
  });

  // Test case: Mongoose, by default, does not validate if end date is after start date.
  // This test confirms that behavior unless a custom validator is added to the schema.
  it('should allow saving if end date is before start date (without a custom start < end validator)', async () => {
     const data = {
        ...createValidScheduleData(),
        start: new Date('2024-08-15T10:00:00Z'),
        end: new Date('2024-08-15T09:00:00Z'), // End date is before start date
     };
     const schedule = new Schedule(data);
     // Expects save to be successful as there's no built-in Mongoose validation for this.
     await expect(schedule.save()).resolves.toBeDefined();
  });

});


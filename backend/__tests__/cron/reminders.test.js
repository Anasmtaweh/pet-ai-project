// Test suite for the reminder cron job's core logic.
const { runReminderCheckJob } = require('../../server'); // Import the job function
const { sendReminderEmail } = require('../../utils/mailer');
const Schedule = require('../../models/Schedule');
const SentReminder = require('../../models/SentReminder');
const { generateOccurrencesInRange } = require('../../utils/scheduleUtils');

// Mock the modules required by the cron job
jest.mock('../../models/Schedule');
jest.mock('../../models/SentReminder');
jest.mock('../../utils/mailer');
jest.mock('../../utils/scheduleUtils');

// Mock the save method for SentReminder instances globally for this test file
const mockSave = jest.fn().mockResolvedValue(true); // Mock successful save
SentReminder.prototype.save = mockSave;


describe('Reminder Cron Job Logic', () => {
  // --- MOCK SETUP FOR find().populate() ---
  // This setup mocks the Mongoose chained call: Schedule.find().populate()
  const mockPopulate = jest.fn(); // Mock for the .populate() method
  const mockFind = jest.fn(() => ({ // Mock for Schedule.find()
      populate: mockPopulate // .find() returns an object with a mock .populate
  }));
  // Assign the mock .find() to the Schedule mock before tests run
  Schedule.find = mockFind;
  // --- END MOCK SETUP ---


  // Resets all relevant mocks before each test case to ensure a clean state and test isolation.
  beforeEach(() => {
    // Reset mocks before each test to ensure test isolation
    mockFind.mockClear(); // Clear calls to Schedule.find
    mockPopulate.mockClear(); // Clear calls to .populate()
    SentReminder.findOne.mockReset(); // Reset mock implementation and calls
    sendReminderEmail.mockReset();
    generateOccurrencesInRange.mockReset();
    mockSave.mockClear(); // Clear calls to the SentReminder instance save mock
  });

  // Test case: Verifies that a reminder email is sent if it hasn't been sent previously for an occurrence.
  it('should send reminder if not sent before', async () => {
    // 1. Arrange: Setup mock data and mock return values for this specific test
    const mockRule = {
      _id: 'schedule-123',
      owner: { _id: 'user-abc', email: 'test@example.com' }, // Populated owner data
      title: 'Test Event',
      start: new Date('2024-01-10T10:00:00Z'),
      end: new Date('2024-01-10T11:00:00Z'),
      repeat: false,
      exceptionDates: [],
      // Mock the .toObject() method Mongoose documents have
      toObject: function() { return { ...this, owner: undefined }; } // Return plain object without populated fields
    };

    // Configure the mock chain for this specific test:
    // Schedule.find().populate(...) should resolve to an array containing mockRule
    mockPopulate.mockResolvedValue([mockRule]);

    // Mock generateOccurrencesInRange to return a specific occurrence
    const mockOccurrence = {
        ruleId: 'schedule-123',
        ownerId: 'user-abc', // Ensure ownerId is present
        title: 'Test Event',
        start: new Date('2024-01-10T10:15:00Z'), // Example time within window
        end: new Date('2024-01-10T11:15:00Z'),
        ownerEmail: 'test@example.com' // Email added back by the job logic
    };
    generateOccurrencesInRange.mockReturnValue([mockOccurrence]);

    // Mock SentReminder.findOne to simulate reminder NOT found (returns null)
    SentReminder.findOne.mockResolvedValue(null);

    // 2. Act: Directly call the job logic function
    await runReminderCheckJob();

    // 3. Assert: Check if functions were called as expected
    expect(mockFind).toHaveBeenCalledTimes(1); // Check if Schedule.find was called
    expect(mockPopulate).toHaveBeenCalledWith('owner', 'email'); // Check if populate was called correctly
    expect(generateOccurrencesInRange).toHaveBeenCalledTimes(1); // Check if occurrence generation was called

    // Check if SentReminder.findOne was called with the correct key
    const expectedKey = `${mockOccurrence.ruleId}_${mockOccurrence.start.getTime()}`;
    expect(SentReminder.findOne).toHaveBeenCalledWith({ reminderKey: expectedKey });

    // Check if email was sent
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(sendReminderEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test Event',
        mockOccurrence.start // Check it passes the Date object
    );

    // Check that the save method on the SentReminder instance was called
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  // Test case: Verifies that duplicate reminders are not sent if a reminder for an occurrence has already been processed.
  it('should prevent duplicate reminders', async () => {
    // 1. Arrange: Setup mock data and mock return values for this specific test
    const mockRule = {
      _id: 'schedule-456',
      owner: { _id: 'user-def', email: 'another@example.com' },
      title: 'Recurring Event',
      start: new Date('2024-01-11T14:00:00Z'),
      end: new Date('2024-01-11T15:00:00Z'),
      repeat: true,
      repeatType: 'daily',
      exceptionDates: [],
      toObject: function() { return { ...this, owner: undefined }; }
    };

    // Configure the mock chain for this test
    mockPopulate.mockResolvedValue([mockRule]);

    // Mock generateOccurrencesInRange
    const mockOccurrence = {
        ruleId: 'schedule-456',
        ownerId: 'user-def',
        title: 'Recurring Event',
        start: new Date('2024-01-11T14:20:00Z'), // Example time within window
        end: new Date('2024-01-11T15:20:00Z'),
        ownerEmail: 'another@example.com'
    };
    generateOccurrencesInRange.mockReturnValue([mockOccurrence]);

    // Mock SentReminder.findOne to simulate reminder WAS found (return a truthy object)
    SentReminder.findOne.mockResolvedValue({ reminderKey: 'some_key', /* other fields */ });

    // 2. Act: Directly call the job logic function
    await runReminderCheckJob();

    // 3. Assert: Check if functions were called as expected
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockPopulate).toHaveBeenCalledWith('owner', 'email');
    expect(generateOccurrencesInRange).toHaveBeenCalledTimes(1);

    // Check findOne was called
    const expectedKey = `${mockOccurrence.ruleId}_${mockOccurrence.start.getTime()}`;
    expect(SentReminder.findOne).toHaveBeenCalledWith({ reminderKey: expectedKey });

    // Crucially, email and save should NOT have been called
    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});


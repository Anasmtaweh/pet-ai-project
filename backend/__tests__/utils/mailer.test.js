// Test suite for mailer utility functions.

const nodemailer = require('nodemailer');
const moment = require('moment-timezone');

// Define mock functions for nodemailer's createTransport behavior.
const mockSendMail = jest.fn();
const mockVerify = jest.fn((callback) => callback(null, true)); // Simulates successful verification.

// Mock the 'nodemailer' module.
// createTransport is mocked to return an object with our defined mock functions.
jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        sendMail: mockSendMail,
        verify: mockVerify
    }))
}));

// Mock the config module to provide default VALID email credentials for most tests.
jest.mock('../../config/config', () => ({
    EMAIL_USER: 'test@example.com',
    EMAIL_PASS: 'testpass',
}));

// Declare variables to be assigned in beforeEach or within specific tests.
let mailer;
let consoleErrorSpy;
let consoleWarnSpy;
let config; // To hold the re-required config module.
let mockCreateTransportReference; // To hold a reference to the mocked nodemailer.createTransport function.

describe('Mailer Utilities', () => {

    // Setup common mocks and require modules with VALID config before each test.
    beforeEach(() => {
        // 1. Reset modules: Clears the Jest module cache to ensure modules are re-required with fresh mocks.
        jest.resetModules();
        // 2. Clear mock calls/instances: Resets call counts and mock implementations from previous tests.
        jest.clearAllMocks();

        // 3. Setup console spies: Spy on console.error and console.warn before requiring modules that might log.
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 4. Require the default VALID mocked config.
        config = require('../../config/config');
        // 5. Require the mailer module: It will initialize with the VALID config due to the mock setup above.
        mailer = require('../../utils/mailer');
        // 6. Get reference to the mock createTransport:
        //    This is done AFTER mailer (and thus nodemailer) is required to get the actual mocked function.
        const actualNodemailerMock = require('nodemailer');
        mockCreateTransportReference = actualNodemailerMock.createTransport;
    });

    // Restore console spies and unmock config after each test.
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        // Ensure config mock is reset if it was overridden in a specific test.
        jest.unmock('../../config/config');
    });

    // Test suite for the sendPasswordResetEmail function.
    describe('sendPasswordResetEmail', () => {
        const testEmail = 'recipient@domain.com';
        const testToken = 'testresettoken12345';
        // const expectedResetLink = `http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com/reset-password/${testToken}`; // Example, actual link generation is in the mailer.

        // Test with VALID config (uses the global beforeEach setup).
        it('should call sendMail with correct options for password reset', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'test-id' }); // Simulate successful email sending.
            await mailer.sendPasswordResetEmail(testEmail, testToken);

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1); // Verifies transporter was created.
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
                to: testEmail,
                subject: 'MISHTIKA Password Reset Request'
            }));
            expect(consoleErrorSpy).not.toHaveBeenCalled(); // No errors should be logged.
        });

        // Test with VALID config but sendMail fails (uses the global beforeEach setup).
        it('should throw error if sendMail fails', async () => {
            const sendError = new Error('SMTP Connection Error');
            mockSendMail.mockRejectedValue(sendError); // Simulate sendMail failure.

            await expect(mailer.sendPasswordResetEmail(testEmail, testToken))
                .rejects.toThrow('SMTP Connection Error');

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send email'), sendError);
        });

        // Test with INVALID config (overrides the global beforeEach setup for this specific test).
        it('should log error and not send if transporter is not configured', async () => {
            // Arrange: Reset modules and mocks, then mock config as INVALID for this test.
            jest.resetModules();
            jest.clearAllMocks();

            // Mock config as INVALID specifically for this test case.
            jest.mock('../../config/config', () => ({
                EMAIL_USER: null,
                EMAIL_PASS: null,
            }));

            // Re-setup console spies AFTER resetting modules.
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Re-require config and mailer, which will now use the INVALID mock.
            config = require('../../config/config');
            mailer = require('../../utils/mailer'); // mailer initializes with transporter = null here.

            // Re-get mock reference (though it won't be called as transporter is null).
            const actualNodemailerMock = require('nodemailer');
            mockCreateTransportReference = actualNodemailerMock.createTransport;

            // Act: Attempt to send the email.
            await mailer.sendPasswordResetEmail(testEmail, testToken);

            // Assert: Verify that email was not sent and appropriate errors/warnings were logged.
            expect(mockSendMail).not.toHaveBeenCalled();
            expect(mockCreateTransportReference).not.toHaveBeenCalled(); // createTransport should not be called.
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Cannot send email ("MISHTIKA Password Reset Request" to ${testEmail}): Email transporter is not configured.`)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                 expect.stringContaining("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.")
            );
        });
    });

    // Test suite for the sendReminderEmail function.
    describe('sendReminderEmail', () => {
        const testEmail = 'recipient@domain.com';
        const testTitle = 'Vet Appointment';
        const testStartTimeUTC = new Date('2024-09-15T14:30:00Z');
        // const expectedFormattedTime = moment(testStartTimeUTC).tz("Asia/Beirut").format('h:mm a on dddd, MMMM Do YYYY'); // Example, actual formatting is in the mailer.

        // Test with VALID config (uses the global beforeEach setup).
        it('should call sendMail with correct options and formatted time for reminder', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'reminder-id' }); // Simulate successful email sending.
            await mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC);

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
                to: testEmail,
                subject: `Reminder: ${testTitle}`
            }));
            // Check that the email body contains the formatted time (specific format depends on mailer implementation).
            const sentHtml = mockSendMail.mock.calls[0][0].html;
            const expectedFormattedTime = moment(testStartTimeUTC).tz("Asia/Beirut").format('h:mm a on dddd, MMMM Do YYYY');
            expect(sentHtml).toContain(expectedFormattedTime);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        // Test with VALID config but sendMail fails (uses the global beforeEach setup).
        it('should throw error if sendMail fails for reminder', async () => {
            const sendError = new Error('Failed sending reminder');
            mockSendMail.mockRejectedValue(sendError); // Simulate sendMail failure.

            await expect(mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC))
                .rejects.toThrow('Failed sending reminder');

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send email'), sendError);
        });

        // Test with INVALID config (overrides the global beforeEach setup for this specific test).
        it('should log error and not send reminder if transporter is not configured', async () => {
            // Arrange: Reset modules and mocks, then mock config as INVALID for this test.
            jest.resetModules();
            jest.clearAllMocks();

            // Mock config as INVALID specifically for this test case.
            jest.mock('../../config/config', () => ({
                EMAIL_USER: null,
                EMAIL_PASS: null,
            }));

            // Re-setup console spies AFTER resetting modules.
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Re-require config and mailer, which will now use the INVALID mock.
            config = require('../../config/config');
            mailer = require('../../utils/mailer'); // mailer initializes with transporter = null here.

            // Re-get mock reference (though it won't be called).
            const actualNodemailerMock = require('nodemailer');
            mockCreateTransportReference = actualNodemailerMock.createTransport;

            // Act: Attempt to send the email.
            await mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC);

            // Assert: Verify that email was not sent and appropriate errors/warnings were logged.
            expect(mockSendMail).not.toHaveBeenCalled();
            expect(mockCreateTransportReference).not.toHaveBeenCalled(); // createTransport should not be called.
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Cannot send email ("Reminder: ${testTitle}" to ${testEmail}): Email transporter is not configured.`)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                 expect.stringContaining("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.")
            );
        });
    });
});


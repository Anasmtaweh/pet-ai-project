// c:\Users\Anas\Desktop\backend\__tests__\utils\mailer.test.js

const nodemailer = require('nodemailer'); 
const moment = require('moment-timezone');

// --- Define the mock functions FIRST ---
const mockSendMail = jest.fn();
const mockVerify = jest.fn((callback) => callback(null, true));
// --- NO mockCreateTransport variable needed here anymore ---
// --- End Defining mock functions ---


// --- Mock nodemailer DIRECTLY ---
// Mock the 'nodemailer' module and define its implementation inline
jest.mock('nodemailer', () => ({
    // createTransport is a function that returns our mock transporter object
    createTransport: jest.fn(() => ({ // Define the mock function for createTransport here
        sendMail: mockSendMail,       // Use the pre-defined mockSendMail
        verify: mockVerify            // Use the pre-defined mockVerify
    }))
}));
// --- End Mocking nodemailer ---


// --- Mock the config module  ---
// This mock provides the DEFAULT VALID config for most tests
jest.mock('../../config/config', () => ({
    EMAIL_USER: 'test@example.com',
    EMAIL_PASS: 'testpass',
}));
// --- End Mocking config ---


// Declare variables that will be assigned in beforeEach or within tests
let mailer;
let consoleErrorSpy;
let consoleWarnSpy;
let config;
let mockCreateTransportReference; // Reference to the mock function inside jest.mock

describe('Mailer Utilities', () => {

    // Setup common mocks and require modules with VALID config before each test
    beforeEach(() => {
        // 1. Reset modules to clear cache and force re-require
        jest.resetModules();
        // 2. Clear mock calls/instances
        jest.clearAllMocks();

        // 3. Setup spies BEFORE requiring modules that might log
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 4. Require the default VALID mocked config
        config = require('../../config/config');
        // 5. Require the mailer module - it will initialize with the VALID config here
        mailer = require('../../utils/mailer');
        // 6. Get reference to the mock createTransport AFTER mailer (and thus nodemailer) is required
        const actualNodemailerMock = require('nodemailer');
        mockCreateTransportReference = actualNodemailerMock.createTransport;
    });

    afterEach(() => {
        // Restore console spies
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        // Ensure config mock is reset if overridden in a test
        jest.unmock('../../config/config');
    });

    describe('sendPasswordResetEmail', () => {
        const testEmail = 'recipient@domain.com';
        const testToken = 'testresettoken12345';
        const expectedResetLink = `http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com/reset-password/${testToken}`;

        // Test with VALID config (uses beforeEach setup)
        it('should call sendMail with correct options for password reset', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'test-id' });
            await mailer.sendPasswordResetEmail(testEmail, testToken);

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: testEmail, subject: 'MISHTIKA Password Reset Request' }));
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        // Test with VALID config but sendMail fails (uses beforeEach setup)
        it('should throw error if sendMail fails', async () => {
            const sendError = new Error('SMTP Connection Error');
            mockSendMail.mockRejectedValue(sendError);

            await expect(mailer.sendPasswordResetEmail(testEmail, testToken))
                .rejects.toThrow('SMTP Connection Error');

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send email'), sendError);
        });

        // Test with INVALID config (overrides beforeEach setup)
        it('should log error and not send if transporter is not configured', async () => {
            // --- Arrange: Reset and setup specifically for this test ---
            jest.resetModules();
            jest.clearAllMocks(); // Clear mocks again just in case

            // Mock config as INVALID *inside this test*
            jest.mock('../../config/config', () => ({
                EMAIL_USER: null,
                EMAIL_PASS: null,
            }));

            // Re-setup spies AFTER resetting modules
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Re-require config and mailer *with the invalid mock active*
            config = require('../../config/config');
            mailer = require('../../utils/mailer'); // mailer now initializes with transporter = null

            // Re-get mock reference (though it won't be called)
            const actualNodemailerMock = require('nodemailer');
            mockCreateTransportReference = actualNodemailerMock.createTransport;
            // --- End Arrange ---

            // Act
            await mailer.sendPasswordResetEmail(testEmail, testToken);

            // Assert
            expect(mockSendMail).not.toHaveBeenCalled();
            expect(mockCreateTransportReference).not.toHaveBeenCalled(); // createTransport not called
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Cannot send email ("MISHTIKA Password Reset Request" to ${testEmail}): Email transporter is not configured.`)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                 expect.stringContaining("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.")
            );
        });
    });

    describe('sendReminderEmail', () => {
        const testEmail = 'recipient@domain.com';
        const testTitle = 'Vet Appointment';
        const testStartTimeUTC = new Date('2024-09-15T14:30:00Z');
        const expectedFormattedTime = moment(testStartTimeUTC).tz("Asia/Beirut").format('h:mm a on dddd, MMMM Do YYYY');

        // Test with VALID config (uses beforeEach setup)
        it('should call sendMail with correct options and formatted time for reminder', async () => {
            mockSendMail.mockResolvedValue({ messageId: 'reminder-id' });
            await mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC);

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: testEmail, subject: `Reminder: ${testTitle}` }));
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        // Test with VALID config but sendMail fails (uses beforeEach setup)
        it('should throw error if sendMail fails for reminder', async () => {
            const sendError = new Error('Failed sending reminder');
            mockSendMail.mockRejectedValue(sendError);

            await expect(mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC))
                .rejects.toThrow('Failed sending reminder');

            expect(mockCreateTransportReference).toHaveBeenCalledTimes(1);
            expect(mockSendMail).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send email'), sendError);
        });

        // Test with INVALID config (overrides beforeEach setup)
        it('should log error and not send reminder if transporter is not configured', async () => {
            // --- Arrange: Reset and setup specifically for this test ---
            jest.resetModules();
            jest.clearAllMocks();

            // Mock config as INVALID *inside this test*
            jest.mock('../../config/config', () => ({
                EMAIL_USER: null,
                EMAIL_PASS: null,
            }));

            // Re-setup spies AFTER resetting modules
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Re-require config and mailer *with the invalid mock active*
            config = require('../../config/config');
            mailer = require('../../utils/mailer'); // mailer now initializes with transporter = null

            // Re-get mock reference (though it won't be called)
            const actualNodemailerMock = require('nodemailer');
            mockCreateTransportReference = actualNodemailerMock.createTransport;
            // --- End Arrange ---

            // Act
            await mailer.sendReminderEmail(testEmail, testTitle, testStartTimeUTC);

            // Assert
            expect(mockSendMail).not.toHaveBeenCalled();
            expect(mockCreateTransportReference).not.toHaveBeenCalled(); // createTransport not called
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Cannot send email ("Reminder: ${testTitle}" to ${testEmail}): Email transporter is not configured.`)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                 expect.stringContaining("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.")
            );
        });
    });
});

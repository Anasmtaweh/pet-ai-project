// Utility module for sending emails using Nodemailer.
const nodemailer = require('nodemailer');
const config = require('../config/config'); // Loads application configuration, including email credentials.
const moment = require('moment-timezone'); // Used for formatting dates/times in specific timezones.

// Validate essential email configuration during application startup.
// If EMAIL_USER or EMAIL_PASS is missing, a warning is logged, and email functionality will be disabled.
if (!config.EMAIL_USER || !config.EMAIL_PASS) {
    console.warn("---------------------------------------------------------------------");
    console.warn("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.");
    console.warn("         Password reset and reminder emails will NOT be sent.");
    console.warn("---------------------------------------------------------------------");
}

// Initialize the Nodemailer transporter.
// The transporter is responsible for the actual sending of emails.
let transporter;
if (config.EMAIL_USER && config.EMAIL_PASS) {
    // Create a transporter object using Gmail as the service.
    // Authentication uses credentials from the application's configuration.
    transporter = nodemailer.createTransport({
        service: 'gmail', // Specifies Gmail as the email service provider.
        auth: {
            user: config.EMAIL_USER, // Gmail address from config (environment variable).
            pass: config.EMAIL_PASS, // Gmail app-specific password from config (environment variable).
        },
    });

    // Verify the transporter connection configuration on startup, except in test environments.
    // This helps to catch configuration issues early.
    if (process.env.NODE_ENV !== 'test') {
        transporter.verify(function(error, success) {
          if (error) {
            console.error("Nodemailer transporter verification failed:", error);
          } else {
            console.log("Nodemailer transporter is ready to send emails.");
          }
        });
    } else {
        // Log that verification is skipped in test environments.
        console.log('Skipping Nodemailer verification in test environment.');
    }
} else {
    // If email credentials are not configured, set the transporter to null.
    // Email sending functions will check for this and avoid attempting to send.
    transporter = null;
}

/**
 * Generic function to send an email using the configured transporter.
 * @param {object} mailOptions - Nodemailer mail options object.
 * @param {string} mailOptions.to - Recipient's email address.
 * @param {string} mailOptions.subject - Subject line of the email.
 * @param {string} [mailOptions.text] - Plain text body of the email.
 * @param {string} [mailOptions.html] - HTML body of the email.
 */
const sendEmail = async (mailOptions) => {
    // If the transporter is not configured (e.g., missing credentials), log an error and do not attempt to send.
    if (!transporter) {
        console.error(`Cannot send email ("${mailOptions.subject}" to ${mailOptions.to}): Email transporter is not configured.`);
        return; // Exit if transporter is not configured.
    }

    // Set a default sender address and name for all outgoing emails.
    const optionsWithDefaults = {
        ...mailOptions,
        from: `"MISHTIKA" <${config.EMAIL_USER}>`, // Sender name and email address.
    };

    try {
        // Attempt to send the email using the transporter.
        let info = await transporter.sendMail(optionsWithDefaults);
        console.log(`Email sent successfully ("${optionsWithDefaults.subject}" to ${optionsWithDefaults.to}): ${info.messageId}`);
        return info; // Return information about the sent email (e.g., messageId).
    } catch (error) {
        // Log any errors that occur during email sending and re-throw the error.
        console.error(`Failed to send email ("${optionsWithDefaults.subject}" to ${optionsWithDefaults.to}):`, error);
        throw error; // Re-throw to allow the caller to handle the error if necessary.
    }
};

/**
 * Sends a password reset email to the specified user.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} resetToken - The unique token for resetting the password.
 */
const sendPasswordResetEmail = async (toEmail, resetToken) => {
    // Construct the password reset link using the frontend's URL structure.
    const resetLink = `http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com/reset-password/${resetToken}`;

    // Define the email options, including recipient, subject, and HTML/text content.
    const mailOptions = {
        to: toEmail,
        subject: 'MISHTIKA Password Reset Request',
        html: `<p>You requested a password reset for your MISHTIKA account.</p>
               <p>Click this link to reset your password (link expires in 1 hour):</p>
               <p><a href="${resetLink}">${resetLink}</a></p>
               <p>If you did not request this, please ignore this email.</p>`,
        text: `You requested a password reset for your MISHTIKA account.\n\nReset your password here (link expires in 1 hour): ${resetLink}\n\nIf you did not request this, please ignore this email.`
    };

    // Use the generic sendEmail function to dispatch the password reset email.
    await sendEmail(mailOptions);
};

/**
 * Sends a reminder email for a scheduled event.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} eventTitle - The title of the scheduled event.
 * @param {Date} eventStartTime - The start time of the event occurrence (expected as a UTC Date object).
 */
const sendReminderEmail = async (toEmail, eventTitle, eventStartTime) => {
    // Define the target timezone for displaying the event time.
    const reminderTimezone = "Asia/Beirut";
    // Convert the UTC event start time to the target timezone and format it.
    const formattedStartTime = moment(eventStartTime).tz(reminderTimezone).format('h:mm a on dddd, MMMM Do YYYY');

    // Define the email options, including recipient, subject, and HTML/text content with the formatted time.
    const mailOptions = {
        to: toEmail,
        subject: `Reminder: ${eventTitle}`,
        html: `<p>This is a reminder for your scheduled event:</p>
               <p><b>${eventTitle}</b></p>
               <p>Starting around: ${formattedStartTime}</p>
               <p>Have a great day!</p>`,
        text: `Reminder for your scheduled event: ${eventTitle}\nStarting around: ${formattedStartTime}\n\nHave a great day!`
    };

    // Use the generic sendEmail function to dispatch the reminder email.
    await sendEmail(mailOptions);
};

// Export the specific email sending functions for use in other parts of the application.
module.exports = {
    sendPasswordResetEmail,
    sendReminderEmail,
};



// c:\Users\Anas\M5\pet-ai-project\backend\utils\mailer.js
const nodemailer = require('nodemailer');
const config = require('../config/config'); // Reads from config.js which reads env vars
const moment = require('moment'); // For formatting dates in reminders

// Validate essential email configuration during startup
if (!config.EMAIL_USER || !config.EMAIL_PASS) {
    console.warn("---------------------------------------------------------------------");
    console.warn("WARNING: Email configuration (EMAIL_USER, EMAIL_PASS) is missing.");
    console.warn("         Password reset and reminder emails will NOT be sent.");
    console.warn("---------------------------------------------------------------------");
}

// Create a reusable transporter object
// Only create it if config exists, otherwise mail attempts will fail anyway
let transporter;
if (config.EMAIL_USER && config.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail', // Or your email service provider
        auth: {
            user: config.EMAIL_USER, // Your Gmail address from config/env
            pass: config.EMAIL_PASS, // Your Gmail app-specific password from config/env
        },
    });

    // Verify connection configuration on startup (optional but good)
    transporter.verify(function(error, success) {
      if (error) {
        console.error("Nodemailer transporter verification failed:", error);
      } else {
        console.log("Nodemailer transporter is ready to send emails.");
      }
    });

} else {
    transporter = null; // Set transporter to null if config is missing
}


/**
 * Generic function to send an email.
 * @param {object} mailOptions - Nodemailer mail options object (to, subject, text, html, etc.)
 * @param {string} mailOptions.to - Recipient email address.
 * @param {string} mailOptions.subject - Email subject line.
 * @param {string} [mailOptions.text] - Plain text body.
 * @param {string} [mailOptions.html] - HTML body.
 */
const sendEmail = async (mailOptions) => {
    if (!transporter) {
        console.error(`Cannot send email ("${mailOptions.subject}" to ${mailOptions.to}): Email transporter is not configured.`);
        // Optionally throw an error or return a failure status
        // throw new Error("Email service is not configured.");
        return; // Exit silently if not configured
    }

    // Set a default sender address
    const optionsWithDefaults = {
        ...mailOptions,
        from: `"MISHTIKA" <${config.EMAIL_USER}>`, // Add a sender name
    };

    try {
        let info = await transporter.sendMail(optionsWithDefaults);
        console.log(`Email sent successfully ("${optionsWithDefaults.subject}" to ${optionsWithDefaults.to}): ${info.messageId}`);
        return info; // Return info on success
    } catch (error) {
        console.error(`Failed to send email ("${optionsWithDefaults.subject}" to ${optionsWithDefaults.to}):`, error);
        throw error; // Re-throw the error to be handled by the caller if needed
    }
};


/**
 * Sends a password reset email.
 * @param {string} toEmail - Recipient email address.
 * @param {string} resetToken - The unique password reset token.
 */
const sendPasswordResetEmail = async (toEmail, resetToken) => {
    // Construct the reset link using the deployed frontend URL
    const resetLink = `http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com/reset-password/${resetToken}`;

    const mailOptions = {
        to: toEmail,
        subject: 'MISHTIKA Password Reset Request',
        html: `<p>You requested a password reset for your MISHTIKA account.</p>
               <p>Click this link to reset your password (link expires in 1 hour):</p>
               <p><a href="${resetLink}">${resetLink}</a></p>
               <p>If you did not request this, please ignore this email.</p>`,
        text: `You requested a password reset for your MISHTIKA account.\n\nReset your password here (link expires in 1 hour): ${resetLink}\n\nIf you did not request this, please ignore this email.`
    };

    await sendEmail(mailOptions); // Use the generic sendEmail function
};


/**
 * Sends a schedule reminder email.
 * @param {string} toEmail - Recipient email address.
 * @param {string} eventTitle - The title of the scheduled event.
 * @param {Date} eventStartTime - The start time of the event occurrence.
 */
const sendReminderEmail = async (toEmail, eventTitle, eventStartTime) => {
    const mailOptions = {
        to: toEmail,
        subject: `Reminder: ${eventTitle}`,
        html: `<p>This is a reminder for your scheduled event:</p>
               <p><b>${eventTitle}</b></p>
               <p>Starting around: ${moment(eventStartTime).format('h:mm a on dddd, MMMM Do YYYY')}</p>
               <p>Have a great day!</p>`,
        text: `Reminder for your scheduled event: ${eventTitle}\nStarting around: ${moment(eventStartTime).format('h:mm a on dddd, MMMM Do YYYY')}\n\nHave a great day!`
    };

    await sendEmail(mailOptions); // Use the generic sendEmail function
};


// Export the specific functions needed elsewhere
module.exports = {
    sendPasswordResetEmail,
    sendReminderEmail,
    // You could also export sendEmail if needed for other types of emails
};


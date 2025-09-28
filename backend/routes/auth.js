const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const RecentActivity = require('../models/RecentActivity');
const crypto =require('crypto');
// config is not directly used here as jwtSecret and mailer already import it.
// const config = require('../config/config');
const jwtSecret = require('../config/jwtSecret');
// adminMiddleware is imported but not used in this file.
// const adminMiddleware = require('../middleware/adminMiddleware');
const userMiddleware = require('../middleware/userMiddleware');
const { sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

// Route for user registration.
// POST /auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, username, age } = req.body;

        // Basic input validation.
        if (!email || typeof email !== 'string' || !password || !username || !age) {
            return res.status(400).json({ message: 'All fields are required and email must be a string' });
        }

        // Check if a user with the given email already exists.
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create a new user instance. Password hashing is handled by the User model's pre-save hook.
        const newUser = new User({ email, password, username, age, role: 'user' });
        await newUser.save();

        // Log the user signup activity.
        await RecentActivity.create({
            type: 'user_signup',
            details: `New user signed up: ${newUser.email}`,
            userId: newUser._id,
        });

        // Exclude password from the response.
        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({ message: 'User created successfully', user: userResponse });
    } catch (error) {
        // Handle potential Mongoose validation errors (e.g., invalid email, password complexity).
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation failed', errors: messages });
        }
        console.error("Error during signup:", error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// Route for user login.
// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate input.
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        if (typeof email !== 'string') {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Find the user by email.
        const user = await User.findOne({ email: { $eq: email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare the provided password with the stored hashed password.
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if the user account is active.
        if (!user.isActive) {
            return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
        }
        // Generate a JSON Web Token (JWT) for the authenticated user.
        const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret.secret, { expiresIn: '1h' });

        // Send the token, role, and active status in the response.
        res.json({ token, message: 'Logged in successfully', role: user.role, isActive: user.isActive });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Route to get the details of the currently authenticated user.
// GET /auth/user
// Protected by userMiddleware to ensure the user is authenticated and has 'user' role.
router.get('/user', userMiddleware, async (req, res) => {
    try {
        // req.user.id is set by the userMiddleware after token verification.
        const user = await User.findById(req.user.id).select('-password'); // Exclude password from response.
        if (!user) {
            // This case should ideally not be reached if userMiddleware is working correctly.
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).json({ message: 'Server error fetching user data' });
    }
});

// Route for a user to update their own password.
// PUT /auth/settings/password
// Protected by userMiddleware.
router.put('/settings/password', userMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify the current password.
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // Set the new password. The User model's pre-save hook will handle hashing and validation.
        user.password = newPassword;
        await user.save(); // This triggers the pre-save hook for hashing and schema validation.

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        // Handle Mongoose validation errors (e.g., new password doesn't meet complexity).
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: 'Password validation failed', errors: messages });
        }
        console.error("Error updating user password:", error);
        res.status(500).json({ message: 'Server error updating password' });
    }
});

// Route for a user to update their own profile information (username, age).
// PUT /auth/settings/profile
// Protected by userMiddleware.
router.put('/settings/profile', userMiddleware, async (req, res) => {
    try {
        const { username, age } = req.body;
        const userId = req.user.id;

        // Validate age on the backend.
        if (age !== undefined && (Number(age) < 13 || Number(age) > 120)) {
            return res.status(400).json({ message: 'Age must be a number between 13 and 120' });
        }

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (age !== undefined) updateData.age = Number(age); // Ensure age is a number.

        // Update the user document. 'runValidators: true' ensures schema validation for age.
        // 'new: true' returns the updated document.
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true } // Enable schema validation for updates.
        ).select('-password'); // Exclude password from the response.

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        // Handle Mongoose validation errors.
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: 'Profile validation failed', errors: messages });
        }
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
});

// Route to initiate the password reset process.
// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
             return res.status(400).json({ message: 'Email is required' });
        }
        if (typeof email !== 'string') {
            return res.status(400).json({ message: 'Invalid email format.' });
        }
        const user = await User.findOne({ email });

        // If user not found, send a generic success message to prevent email enumeration.
        if (!user) {
            return res.status(200).json({ message: 'If an account with that email exists, a password reset email has been sent.' });
        }

        // Generate a secure random token for password reset.
        const token = crypto.randomBytes(20).toString('hex');
        // Create and save the password reset token, linking it to the user.
        const passwordResetToken = new PasswordResetToken({
            userId: user._id,
            token,
        });
        await passwordResetToken.save();

        // Send the password reset email containing the token.
        await sendPasswordResetEmail(user.email, token);

        res.status(200).json({ message: 'If an account with that email exists, a password reset email has been sent.' });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ message: 'Internal server error processing request.' });
    }
});

// Route to reset the password using a valid token.
// POST /auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        // Find the password reset token.
        const passwordResetToken = await PasswordResetToken.findOne({ token });

        if (!passwordResetToken) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Find the user associated with the token.
        const user = await User.findById(passwordResetToken.userId);
        if (!user) {
            // This case might indicate an orphaned token or a deleted user.
            return res.status(404).json({ message: 'User not found' });
        }

        // Set the new password. The User model's pre-save hook will handle hashing and validation.
        user.password = password;
        await user.save(); // This triggers the pre-save hook for hashing and schema validation.

        // Delete the used password reset token.
        await PasswordResetToken.deleteOne({ token });

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        // Handle Mongoose validation errors (e.g., new password doesn't meet complexity).
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: 'Password validation failed', errors: messages });
        }
        console.error('Error in reset password:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;




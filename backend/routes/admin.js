const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Pet = require('../models/Pet');
const Schedule = require('../models/Schedule');
const RecentActivity = require('../models/RecentActivity');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcrypt');

// Set up a rate limiter for sensitive admin changes (profile, password, etc.)
const profileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // limit each user to 5 requests per windowMs
    message: { message: 'Too many profile update attempts, please try again later.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Helper function for logging recent activities.
const logActivity = async (type, details, userId, adminUserId = null, petId = null, scheduleId = null) => {
    try {
        await RecentActivity.create({
            type,
            details,
            userId, // ID of the user the activity relates to (e.g., the one being deleted)
            // actorId: adminUserId, // Example: field to log which admin performed the action
            petId,
            scheduleId,
        });
    } catch (logError) {
        console.error(`Failed to log activity (${type}):`, logError);
    }
};


// Route to get the details of the currently authenticated admin user.
// GET /admin/user
router.get('/user', adminMiddleware, async (req, res) => {
    try {
        // req.user.id is set by the adminMiddleware
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            // Should not happen if middleware passed, but good practice
            return res.status(404).json({ message: 'Admin user not found' });
        }
        res.json(user);
    } catch (error) {
        console.error("Error fetching admin user data:", error);
        res.status(500).json({ message: 'Server error fetching admin data' });
    }
});

// Route to get dashboard statistics for the admin panel.
// GET /admin/dashboard
router.get('/dashboard', adminMiddleware, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPets = await Pet.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });

        // Fetch recent activity, sorted by most recent, with populated details.
        const recentActivity = await RecentActivity.find()
            .sort({ timestamp: -1 }) // Sort by timestamp descending
            .limit(10) // Limit to the last 10 activities
            .populate('userId', 'email username') // Optionally populate user details
            .populate('petId', 'name') // Optionally populate pet details
            .populate('scheduleId', 'title'); // Optionally populate schedule details

        res.json({
            totalUsers,
            totalPets,
            activeUsers,
            recentActivity,
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ message: 'Server error fetching dashboard data' });
    }
});

// Route to get a list of all users in the system.
// GET /admin/users
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude password from the response
        res.json(users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

// Route to delete a user and all their associated data (pets, schedules).
// DELETE /admin/users/:id
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
        const adminUserId = req.user.id; // ID of the admin performing the action
        const userIdToDelete = req.params.id;

        const user = await User.findById(userIdToDelete);
        if (!user) {
            // If user not found, return 404 immediately
            return res.status(404).json({ message: 'User not found' });
        }

        const userEmail = user.email; // User's email for logging purposes.

        // Find pets owned by the user.
        const pets = await Pet.find({ owner: userIdToDelete });

        // Log deletion for each pet and then delete them.
        for (const pet of pets) {
            await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, user._id, adminUserId, pet._id); // Log before deleting
            await Pet.findByIdAndDelete(pet._id); // Delete the pet
        }

        // Delete schedules owned by the user.
        await Schedule.deleteMany({ owner: userIdToDelete });

        // Delete the user AFTER associated data has been handled.
        await User.findByIdAndDelete(userIdToDelete);

        // Log user deletion.
        await logActivity('user_deleted', `User deleted: ${userEmail}`, user._id, adminUserId);

        res.json({ message: 'User and associated pets and schedules deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error during user deletion' });
    }
});

// Route to update a user's status (activate/deactivate).
// PUT /admin/users/:id
router.put('/users/:id', adminMiddleware, async (req, res) => {
    const userId = req.params.id;
    const { isActive: requestedStatus } = req.body; // Get the requested status from the request body.

    // Validate that the received isActive value is a boolean.
    if (typeof requestedStatus !== 'boolean') {
        console.error("Invalid data type received for isActive. Expected boolean.");
        return res.status(400).json({ message: 'Invalid value provided for isActive status. Must be true or false.' });
    }

    let initialStatus = null;
    let finalStatus = null;
    let userFound = false;
    let saveError = null;

    try {
        // Find the user document to be updated.
        const userToUpdate = await User.findById(userId);

        if (!userToUpdate) {
            return res.status(404).json({ message: 'User not found' });
        }

        userFound = true;
        initialStatus = userToUpdate.isActive; // Store the status before any changes.

        // Prevent unnecessary database write if the status is already the same as requested.
        if (userToUpdate.isActive === requestedStatus) {
             return res.json({
                message: 'User status already matches requested status. No update performed.',
                userId: userId,
                userFound: true,
                requestedStatus: requestedStatus,
                initialStatus: initialStatus,
                finalStatus: initialStatus, // Status remains unchanged.
                saveError: null
            });
        }

        // Modify the user's isActive status in memory.
        userToUpdate.isActive = requestedStatus;

        // Save the modified document to the database.
        const savedUser = await userToUpdate.save();

        // Confirm the status after the save operation.
        finalStatus = savedUser.isActive;

        // Send a detailed response back to the client.
        res.json({
            message: 'User status update attempted successfully',
            userId: userId,
            userFound: userFound,
            requestedStatus: requestedStatus,
            initialStatus: initialStatus,
            finalStatus: finalStatus, // Status according to the saved document.
            saveError: null
        });

    } catch (error) {
        // Log any errors that occurred during the find or save process.
        console.error('Error processing status update for user %s:', userId, error);
        saveError = error.message;
        res.status(500).json({
             message: 'Server error occurred during status update',
             userId: userId,
             userFound: userFound,
             requestedStatus: requestedStatus,
             initialStatus: initialStatus, // Assume no change if save failed.
             finalStatus: initialStatus,
             saveError: saveError
        });
    }
});

// Route to get all pets, populating owner's email.
// GET /admin/pets
router.get('/pets', adminMiddleware, async (req, res) => {
    try {
        const pets = await Pet.find().populate('owner', 'email'); // Populate the 'owner' field with 'email'.

        // Map through pets to add ownerName (using owner's email).
        const petsWithOwnerNames = pets.map(pet => ({
            ...pet.toObject(), // Convert mongoose document to a plain JavaScript object.
            ownerName: pet.owner ? pet.owner.email : 'No Owner' // Check if pet.owner exists and use email.
        }));

        res.json(petsWithOwnerNames); // Send the modified list of pets.
    } catch (error) {
        console.error("Error fetching all pets for admin:", error);
        res.status(500).json({ message: 'Server error fetching pets' });
    }
});


// Route to delete a specific pet by its ID.
// DELETE /admin/pets/:id
router.delete('/pets/:id', adminMiddleware, async (req, res) => {
    try {
        const adminUserId = req.user.id;
        const petIdToDelete = req.params.id;

        // Find the pet by ID and delete it. findByIdAndDelete returns the deleted document.
        const pet = await Pet.findByIdAndDelete(petIdToDelete);

        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        // Log the pet deletion activity.
        await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, pet.owner, adminUserId, pet._id);

        res.json({ message: 'Pet deleted successfully' });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// Route for an admin to update their own password.
// PUT /admin/settings/password
router.put('/settings/password', profileLimiter, adminMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id; // Get admin's ID from the authenticated user in middleware.

        // Basic validation for required fields.
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            // This case should ideally not be reached if adminMiddleware is working correctly.
            return res.status(404).json({ message: 'Admin user not found' });
        }

        // Verify the current password.
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // Assign the new password. The pre-save hook in the User model will handle hashing.
        user.password = newPassword;
        await user.save(); // This will trigger the pre-save hook and schema validations.

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        // Handle potential validation errors from the User model's pre-save hook or schema.
        if (error.name === 'ValidationError') {
             console.error("Password validation error:", error.message);
             const messages = Object.values(error.errors).map(e => e.message);
             return res.status(400).json({ message: messages.join(', ') || 'Password validation failed.' });
        }
        console.error("Error updating admin password:", error);
        res.status(500).json({ message: 'Server error updating password' });
    }
});

// Route for an admin to update their own profile information (username, age).
// PUT /admin/settings/profile
router.put('/settings/profile', profileLimiter, adminMiddleware, async (req, res) => {
    try {
        const { username, age } = req.body;
        const userId = req.user.id; // Get admin's ID from the authenticated user in middleware.

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (age !== undefined) updateData.age = age;

        // Basic validation to ensure some data is provided for update.
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No update data provided (username or age).' });
        }

        // Validate age specifically if it's provided in the update.
        if (updateData.age !== undefined) {
            const numericAge = Number(updateData.age);
            if (isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
                return res.status(400).json({ message: 'Age must be a number between 13 and 120' });
            }
            updateData.age = numericAge; // Ensure age is stored as a number.
        }

        // Use findByIdAndUpdate with $set to only update the provided fields.
        // runValidators: true ensures schema rules (e.g., age min/max) are checked during the update.
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true } // Options: return the updated document and run schema validators.
        ).select('-password'); // Exclude password from the response.

        if (!updatedUser) {
            // This case should ideally not be reached if adminMiddleware is working correctly.
            return res.status(404).json({ message: 'Admin user not found' });
        }

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
         // Handle potential validation errors from findByIdAndUpdate.
        if (error.name === 'ValidationError') {
             console.error("Profile validation error:", error.message);
             const messages = Object.values(error.errors).map(e => e.message);
             return res.status(400).json({ message: messages.join(', ') || 'Profile validation failed.' });
        }
        console.error("Error updating admin profile:", error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
});

module.exports = router;




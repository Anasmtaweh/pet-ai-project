// c:\Users\Anas\Desktop\backend\routes\admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Schedule = require('../models/Schedule');
const RecentActivity = require('../models/RecentActivity');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcrypt');

// Helper function for logging activity (optional, but good practice)
// You might want to move this to a separate utility file
const logActivity = async (type, details, userId, adminUserId = null, petId = null, scheduleId = null) => {
    try {
        await RecentActivity.create({
            type,
            details,
            userId, // ID of the user the activity relates to (e.g., the one being deleted)
            // You could add an 'actorId' field to log which admin performed the action
            // actorId: adminUserId,
            petId,
            scheduleId,
        });
    } catch (logError) {
        console.error(`Failed to log activity (${type}):`, logError);
        // Decide if you want to throw or just log the error
    }
};


// GET /admin/user - Get current admin user details
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

// GET /admin/dashboard - Get dashboard statistics
router.get('/dashboard', adminMiddleware, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPets = await Pet.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });

        // Fetch recent activity
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

// GET /admin/users - Get all users
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude password
        res.json(users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

// DELETE /admin/users/:id - Delete a user and their associated data
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
        const adminUserId = req.user.id; // ID of the admin performing the action
        const userIdToDelete = req.params.id;

        // ---  Find the user first ---
        const user = await User.findById(userIdToDelete);
        if (!user) {
            // If user not found, return 404 immediately
            return res.status(404).json({ message: 'User not found' });
        }
        // --- END  ---

        const userEmail = user.email; // Now safe to access

        // Find pets owned by the user
        const pets = await Pet.find({ owner: userIdToDelete });

        // Log deletion for each pet and delete them
        for (const pet of pets) {
            await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, user._id, adminUserId, pet._id); // Log before deleting
            await Pet.findByIdAndDelete(pet._id); // Delete the pet
        }

        // Delete schedules owned by the user
        await Schedule.deleteMany({ owner: userIdToDelete });
        // Optionally log schedule deletions if needed

        // Delete the user AFTER associated data
        await User.findByIdAndDelete(userIdToDelete);

        // Log user deletion
        await logActivity('user_deleted', `User deleted: ${userEmail}`, user._id, adminUserId);

        res.json({ message: 'User and associated pets and schedules deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error during user deletion' });
    }
});

// PUT /admin/users/:id - Update user status (activate/deactivate)
router.put('/users/:id', adminMiddleware, async (req, res) => {
    const userId = req.params.id;
    const { isActive: requestedStatus } = req.body; // Get the requested status from body

    

    // Validate the received value
    if (typeof requestedStatus !== 'boolean') {
        console.error("Invalid data type received for isActive. Expected boolean.");
        return res.status(400).json({ message: 'Invalid value provided for isActive status. Must be true or false.' });
    }

    let initialStatus = null;
    let finalStatus = null;
    let userFound = false;
    let saveError = null;

    try {
        // 1. Find the user document
        const userToUpdate = await User.findById(userId);

        if (!userToUpdate) {
            // console.log(`User with ID ${userId} not found.`);
            return res.status(404).json({ message: 'User not found' });
        }

        userFound = true;
        initialStatus = userToUpdate.isActive; // Get status before change
        // console.log(`Initial status found in DB: ${initialStatus}`);

        // Prevent unnecessary DB write if status is already the same
        if (userToUpdate.isActive === requestedStatus) {
             // console.log(`User status is already ${requestedStatus}. No update needed.`);
             return res.json({
                message: 'User status already matches requested status. No update performed.',
                userId: userId,
                userFound: true,
                requestedStatus: requestedStatus,
                initialStatus: initialStatus,
                finalStatus: initialStatus, // Status remains unchanged
                saveError: null
            });
        }

        // 2. Modify the document in memory USING THE REQUESTED STATUS
        // console.log(`Attempting to set isActive to: ${requestedStatus}`);
        userToUpdate.isActive = requestedStatus;

        // 3. Save the modified document
        const savedUser = await userToUpdate.save();

        // 4. Check the status *after* saving
        finalStatus = savedUser.isActive;
        // console.log(`Status after .save() attempt: ${finalStatus}`);
        // console.log(`--- End Update User Status (Using .save()) ---`);

        // 5. Send detailed response back to frontend
        res.json({
            message: 'User status update attempted successfully', // Updated message
            userId: userId,
            userFound: userFound,
            requestedStatus: requestedStatus,
            initialStatus: initialStatus,
            finalStatus: finalStatus, // Status according to the saved document
            saveError: null
        });

    } catch (error) {
        // Log any errors during the find or save process
        console.error(`Error processing status update for user ${userId}:`, error);
        saveError = error.message;
        res.status(500).json({
             message: 'Server error occurred during status update',
             userId: userId,
             userFound: userFound,
             requestedStatus: requestedStatus,
             initialStatus: initialStatus,
             finalStatus: initialStatus, // Assume no change if save failed
             saveError: saveError
        });
    }
});

// GET /admin/pets - Get all pets with owner email
router.get('/pets', adminMiddleware, async (req, res) => {
    try {
        const pets = await Pet.find().populate('owner', 'email'); // Populate the 'owner' field with 'email'

        // Create the petWithOwner array
        const petsWithOwnerNames = pets.map(pet => ({
            ...pet.toObject(), // Convert mongoose doc to plain object
            ownerName: pet.owner ? pet.owner.email : 'No Owner' // Check if pet.owner exists and use email
        }));

        res.json(petsWithOwnerNames); // Send the pet list
    } catch (error) {
        console.error("Error fetching all pets for admin:", error);
        res.status(500).json({ message: 'Server error fetching pets' });
    }
});


// DELETE /admin/pets/:id - Delete a specific pet
router.delete('/pets/:id', adminMiddleware, async (req, res) => {
    try {
        const adminUserId = req.user.id;
        const petIdToDelete = req.params.id;

        // Use findByIdAndDelete which returns the deleted document (if found)
        const pet = await Pet.findByIdAndDelete(petIdToDelete);

        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        // Log pet deletion
        await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, pet.owner, adminUserId, pet._id);



        res.json({ message: 'Pet deleted successfully' }); // Updated message
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// PUT /admin/settings/password - Update admin's own password
router.put('/settings/password', adminMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id; // Get admin's ID from middleware

        // Basic validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            // Should not happen if middleware passed
            return res.status(404).json({ message: 'Admin user not found' });
        }

        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // Assign the new password (pre-save hook will hash it)
        user.password = newPassword;
        await user.save(); // Trigger pre-save hook and validation

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        // Handle potential validation errors from the pre-save hook
        if (error.name === 'ValidationError') {
             console.error("Password validation error:", error.message);
             // Extract a user-friendly message if possible
             const messages = Object.values(error.errors).map(e => e.message);
             return res.status(400).json({ message: messages.join(', ') || 'Password validation failed.' });
        }
        console.error("Error updating admin password:", error);
        res.status(500).json({ message: 'Server error updating password' });
    }
});

// PUT /admin/settings/profile - Update admin's own profile (username, age)
router.put('/settings/profile', adminMiddleware, async (req, res) => {
    try {
        const { username, age } = req.body;
        const userId = req.user.id; // Get admin's ID from middleware

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (age !== undefined) updateData.age = age;

        // Basic validation
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No update data provided (username or age).' });
        }

        // Validate age specifically if provided
        if (updateData.age !== undefined) {
            const numericAge = Number(updateData.age);
            if (isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
                return res.status(400).json({ message: 'Age must be a number between 13 and 120' });
            }
            updateData.age = numericAge; // Ensure it's stored as a number
        }

        // Use findByIdAndUpdate with $set to only update provided fields
        // runValidators: true ensures schema rules (like age min/max) are checked
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true } // Return updated doc, run validators
        ).select('-password'); // Exclude password from response

        if (!updatedUser) {
            // Should not happen if middleware passed
            return res.status(404).json({ message: 'Admin user not found' });
        }

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
         // Handle potential validation errors from findByIdAndUpdate
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



const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Schedule = require('../models/Schedule');
const RecentActivity = require('../models/RecentActivity');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcrypt');

router.get('/dashboard', adminMiddleware, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPets = await Pet.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });

        // Fetch recent activity
        const recentActivity = await RecentActivity.find()
            .sort({ timestamp: -1 }) // Sort by timestamp descending
            .limit(10); // Limit to the last 10 activities

        res.json({
            totalUsers,
            totalPets,
            activeUsers,
            recentActivity,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get all users
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude password
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Delete user
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;

        // Delete associated pets
        const pets = await Pet.find({ owner: userId });
        await Pet.deleteMany({ owner: userId });
        // Delete associated schedules
        await Schedule.deleteMany({ owner: userId });
        // Delete the user
        const user = await User.findByIdAndDelete(userId);
        // Add recent activity
        await RecentActivity.create({
            type: 'user_deleted',
            details: `User deleted: ${user.email}`,
            userId: user._id,
        });
        // Add recent activity for each pet deleted
        for (const pet of pets) {
            await RecentActivity.create({
                type: 'pet_deleted',
                details: `Pet deleted: ${pet.name}`,
                userId: pet.owner,
                petId: pet._id,
            });
        }
        res.json({ message: 'User and associated pets and schedules deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update user status
router.put('/users/:id', adminMiddleware, async (req, res) => {
    const userId = req.params.id;
    const { isActive: requestedStatus } = req.body; // Get the requested status from body

    console.log(`--- Updating User Status (Revised) ---`);
    console.log(`User ID: ${userId}`);
    console.log(`Received Request Body:`, req.body);
    console.log(`Requested isActive status: ${requestedStatus} (Type: ${typeof requestedStatus})`);

    // Validate the received value
    if (typeof requestedStatus !== 'boolean') {
        console.error("Invalid data type received for isActive. Expected boolean.");
        return res.status(400).json({ message: 'Invalid value provided for isActive status. Must be true or false.' });
    }

    let initialStatus = null;
    let finalStatus = null;
    let userFound = false;
    let updateError = null;

    try {
        // 1. Find the user first to get the initial status
        const userBeforeUpdate = await User.findById(userId).select('isActive'); // Only select isActive field

        if (!userBeforeUpdate) {
            console.log(`User with ID ${userId} not found before update attempt.`);
            return res.status(404).json({ message: 'User not found' });
        }

        userFound = true;
        initialStatus = userBeforeUpdate.isActive;
        console.log(`Initial status found in DB: ${initialStatus}`);

        // 2. Perform the update using the requested status
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive: requestedStatus }, // Use the value directly from req.body
            { new: true } // Return the modified document
        );

        // Check if the update command returned a user (it should if findById found one)
        if (!updatedUser) {
             // This case is less likely if userBeforeUpdate was found, but good to check
             console.error(`Update command did not return user ${userId}, though found initially.`);
             updateError = 'Update command failed unexpectedly after user was found.';
             // We might not have the finalStatus if updatedUser is null
             finalStatus = initialStatus; // Assume no change if update failed
        } else {
            finalStatus = updatedUser.isActive;
            console.log(`Status after update attempt (from updatedUser): ${finalStatus}`);
        }

        console.log(`--- End Update User Status (Revised) ---`);

        // 3. Send detailed response back to frontend
        res.json({
            message: updateError ? 'Error during update' : 'User status update attempted',
            userId: userId,
            userFound: userFound,
            requestedStatus: requestedStatus,
            initialStatus: initialStatus,
            finalStatus: finalStatus, // Status according to the updated document returned by Mongoose
            updateError: updateError // Include any specific update error message
        });

    } catch (error) {
        // Log any errors during the process
        console.error(`Error processing status update for user ${userId}:`, error);
        res.status(500).json({
             message: 'Server error occurred during status update',
             error: error.message // Send back the error message
        });
    }
});
// Get all pets with owner names
// Get all pets with owner names
// Get all pets with owner names
router.get('/pets', adminMiddleware, async (req, res) => {
    try {
        const pets = await Pet.find().populate('owner', 'email'); // Populate the 'owner' field with 'email'
        // create the petWithOwner
        const petsWithOwnerNames = pets.map(pet => ({
            ...pet.toObject(), // Convert mongoose doc to plain object
            ownerName: pet.owner ? pet.owner.email : 'No Owner' // Check if pet.owner exists
        }));
        res.json(petsWithOwnerNames); // Send the pet list
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Delete Pet
router.delete('/pets/:id', adminMiddleware, async (req, res) => {
    try {
        const pet = await Pet.findByIdAndDelete(req.params.id);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        // Add recent activity
        await RecentActivity.create({
            type: 'pet_deleted',
            details: `Pet deleted: ${pet.name}`,
            userId: pet.owner,
            petId: pet._id,
        });
        res.json({ message: 'Pet deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update admin password
router.put('/settings/password', adminMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }
        // Remove the validation and hashing here
        user.password = newPassword; // Just assign the new password
        await user.save(); // Let the pre('save') hook handle the hashing
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});



// Update admin profile
router.put('/settings/profile', adminMiddleware, async (req, res) => {
    try {
        const { username, age } = req.body;
        const userId = req.user.id;

        // Validate age on the backend
        if (age < 13 || age > 120) {
            return res.status(400).json({ message: 'Age must be between 13 and 120' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { username, age } }, // Use $set to update only these fields
            { new: true, runValidators: false } // Return the updated document and disable validators
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

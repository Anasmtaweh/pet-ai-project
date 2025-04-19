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
    // We still receive the body but will ignore isActive for now
    const { isActive: requestedStatus } = req.body;

    console.log(`--- DIAGNOSTIC: Forcing User Status to FALSE ---`);
    console.log(`User ID: ${userId}`);
    console.log(`Received Request Body (for reference):`, req.body); // Log what was sent
    console.log(`Requested isActive status (ignored): ${requestedStatus}`);

    let initialStatus = null;
    let finalStatus = null;
    let userFound = false;
    let saveError = null;

    try {
        // 1. Find the user document
        const userToUpdate = await User.findById(userId);

        if (!userToUpdate) {
            console.log(`User with ID ${userId} not found.`);
            return res.status(404).json({ message: 'User not found' });
        }

        userFound = true;
        initialStatus = userToUpdate.isActive; // Get status before change
        console.log(`Initial status found in DB: ${initialStatus}`);

        // 2. --- FORCE THE VALUE TO FALSE ---
        console.log(`!!! DIAGNOSTIC: Hardcoding isActive to false before save !!!`);
        userToUpdate.isActive = false; // <--- HARDCODING TO FALSE HERE
        // ------------------------------------

        // 3. Save the modified document
        const savedUser = await userToUpdate.save();

        // 4. Check the status *after* saving
        finalStatus = savedUser.isActive;
        console.log(`Status after .save() attempt (forced false): ${finalStatus}`);

        console.log(`--- End DIAGNOSTIC ---`);

        // 5. Send detailed response back to frontend
        res.json({
            message: 'DIAGNOSTIC: User status update FORCED to false',
            userId: userId,
            userFound: userFound,
            requestedStatus: requestedStatus, // Still report what was requested
            initialStatus: initialStatus,
            finalStatus: finalStatus, // Status according to the saved document
            saveError: null
        });

    } catch (error) {
        // Log any errors during the find or save process
        console.error(`DIAGNOSTIC Error processing forced status update for user ${userId}:`, error);
        saveError = error.message;
        res.status(500).json({
             message: 'Server error during DIAGNOSTIC forced update',
             userId: userId,
             userFound: userFound,
             requestedStatus: requestedStatus,
             initialStatus: initialStatus,
             finalStatus: initialStatus, // Assume no change if save failed
             saveError: saveError
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

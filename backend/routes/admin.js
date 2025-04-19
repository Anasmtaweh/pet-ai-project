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
    try {
        const userId = req.params.id;
        // 1. Explicitly check the request body
        const { isActive } = req.body;

        // 2. Add Detailed Logging
        console.log(`--- Updating User Status ---`);
        console.log(`User ID: ${userId}`);
        console.log(`Received Request Body:`, req.body);
        console.log(`Value received for isActive: ${isActive}`);
        console.log(`Type of isActive received: ${typeof isActive}`);

        // 3. Validate the received value (optional but good practice)
        if (typeof isActive !== 'boolean') {
            console.error("Invalid data type received for isActive. Expected boolean.");
            return res.status(400).json({ message: 'Invalid value provided for isActive status. Must be true or false.' });
        }

        // 4. Perform the update using the received value
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive: isActive }, // Use the value directly from req.body
            { new: true } // Option to return the modified document
        );

        // 5. Check if the user was found and updated
        if (!updatedUser) {
            console.log(`User with ID ${userId} not found for update.`);
            return res.status(404).json({ message: 'User not found' });
        }

        // 6. Log the result
        console.log(`User ${userId} status successfully updated in DB. New status:`, updatedUser.isActive);
        console.log(`--- End Update User Status ---`);

        // 7. Send response
        res.json({ message: 'User status updated successfully', user: updatedUser }); // Optionally send back updated user data

    } catch (error) {
        // Log any errors during the process
        console.error(`Error updating status for user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error occurred while updating user status' });
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

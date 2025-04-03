const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');

router.post('/add', async (req, res) => {
    try {
        const { name, ageYears, ageMonths, weight, species, breed, medicalInfo, owner, pictures } = req.body;

        // Validate required fields
        if (!name || !ageMonths || !weight || !species || !breed || !owner) {
            return res.status(400).json({ message: 'Name, ageMonths, weight, species, breed, and owner are required.' });
        }

        // Validate ageMonths
        if (ageMonths > 11 || ageMonths < 0) {
            return res.status(400).json({ message: 'Age in months must be between 0 and 11.' });
        }

        // Validate ageYears (allow 0)
        if (typeof ageYears !== 'number' || ageYears < 0) {
            return res.status(400).json({ message: 'Age in years must be a non-negative number.' });
        }

        // Validate weight
        if (typeof weight !== 'number' || weight < 0) {
            return res.status(400).json({ message: 'Weight must be a non-negative number.' });
        }

        if (!['Cat', 'Dog'].includes(species)) {
            return res.status(400).json({ message: 'Species must be either Cat or Dog.' });
        }

        const user = await User.findById(owner);
        if (!user) {
            return res.status(404).json({ message: 'Owner not found.' });
        }

        const newPet = new Pet({ name, ageYears, ageMonths, weight, species, breed, medicalInfo, owner, pictures });
        await newPet.save();

        await RecentActivity.create({
            type: 'pet_added',
            details: `New pet added: ${newPet.name}`,
            userId: newPet.owner,
            petId: newPet._id,
        });

        res.status(201).json(newPet);
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all pets for a user
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const pets = await Pet.find({ owner: req.params.ownerId });
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found for this user' });
        }
        // Fetch owner names for each pet
        const petsWithOwnerNames = await Promise.all(pets.map(async (pet) => {
            const owner = await User.findById(pet.owner);
            return { ...pet._doc, ownerName: owner ? owner.username : 'Unknown' }; // add owner name to the pet
        }));
        res.json(petsWithOwnerNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get all pets
router.get('/', async (req, res) => {
    try {
        const pets = await Pet.find({});
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found' });
        }
        res.json(pets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Delete Pet
router.delete('/:id', async (req, res) => {
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
// Get Pet by ID
router.get('/:id', async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(pet);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update Pet
router.put('/:id', async (req, res) => {
    try {
        const updatedPet = await Pet.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(updatedPet);
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

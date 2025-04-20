const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');

router.post('/add', async (req, res) => {
    try {
        // --- Destructure gender ---
        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner, pictures } = req.body;

        // --- Update validation message ---
        if (!name || !ageMonths || !weight || !species || !gender || !breed || !owner) { // Added gender
            return res.status(400).json({ message: 'Name, ageMonths, weight, species, gender, breed, and owner are required.' });
        }

        // Validate ageMonths, ageYears, weight (keep existing checks)
        // ...

        if (!['Cat', 'Dog'].includes(species)) {
            return res.status(400).json({ message: 'Species must be either Cat or Dog.' });
        }

        // --- Add gender validation ---
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }
        // --- End gender validation ---

        const user = await User.findById(owner);
        if (!user) {
            return res.status(404).json({ message: 'Owner not found.' });
        }

        // --- Include gender in new Pet ---
        const newPet = new Pet({ name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner, pictures });
        await newPet.save(); // Mongoose enum validation will run here

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
            // Mongoose validation errors (including enum) will be caught here
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
        // The existing req.body will automatically include gender if sent from frontend
        // Mongoose will validate the enum on update if runValidators is true,
        // but even without it, it won't save an invalid enum value.
        // Let's add runValidators for consistency.
        const updatedPet = await Pet.findByIdAndUpdate(req.params.id, req.body, {
             new: true,
             runValidators: true // Ensure validators (like enum) run on update
        });
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

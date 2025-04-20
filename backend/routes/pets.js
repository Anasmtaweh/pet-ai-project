// c:\Users\Anas\M5\pet-ai-project\backend\routes\pets.js
const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');
// No multer needed as frontend sends JSON

router.post('/add', async (req, res) => {
    try {
        // Destructure fields from req.body (populated by express.json())
        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        // --- REVISED Validation ---
        // Check for presence and non-empty strings for required text fields
        if (!name || !species || !gender || !breed || !owner) {
             console.error("Validation Failed - Missing Text Fields. Received body:", req.body);
             return res.status(400).json({ message: 'Name, species, gender, breed, and owner are required.' });
        }
        // Check specifically if numeric fields are missing (null/undefined) or not numbers
        // Allow 0 for ageMonths and ageYears, but require weight > 0
        if (ageYears === undefined || ageYears === null || isNaN(Number(ageYears)) || Number(ageYears) < 0) {
            console.error("Validation Failed - Invalid ageYears. Received body:", req.body);
            return res.status(400).json({ message: 'Valid age in years (0 or greater) is required.' });
        }
        // Check ageMonths validity (0-11)
        if (ageMonths === undefined || ageMonths === null || isNaN(Number(ageMonths)) || Number(ageMonths) < 0 || Number(ageMonths) > 11 ) {
            console.error("Validation Failed - Invalid ageMonths. Received body:", req.body);
            return res.status(400).json({ message: 'Valid age in months (0-11) is required.' });
        }
        // Check weight validity (> 0)
         if (weight === undefined || weight === null || isNaN(Number(weight)) || Number(weight) <= 0) {
            console.error("Validation Failed - Invalid weight. Received body:", req.body);
            return res.status(400).json({ message: 'Valid weight (greater than 0) is required.' });
        }
        // --- End REVISED Validation ---


        // Further specific validations (like enums)
        if (!['Cat', 'Dog'].includes(species)) {
            return res.status(400).json({ message: 'Species must be either Cat or Dog.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }

        const user = await User.findById(owner);
        if (!user) {
            return res.status(404).json({ message: 'Owner not found.' });
        }

        // Create new Pet - ensure numeric values are stored correctly
        const newPet = new Pet({
            name,
            ageYears: Number(ageYears), // Ensure stored as number
            ageMonths: Number(ageMonths), // Ensure stored as number
            weight: Number(weight),     // Ensure stored as number
            species,
            gender,
            breed,
            medicalInfo,
            owner,
            pictures: [] // No pictures being handled in this version
        });
        await newPet.save(); // Mongoose validation will also run here

        await RecentActivity.create({
            type: 'pet_added',
            details: `New pet added: ${newPet.name}`,
            userId: newPet.owner,
            petId: newPet._id,
        });

        res.status(201).json(newPet);
    } catch (error) {
        console.error("Error in /pets/add:", error);
        if (error.name === 'ValidationError') {
            // Mongoose validation errors
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
            // Use pet._doc to get plain object if needed, or just access properties
            return { ...pet._doc, ownerName: owner ? owner.username : 'Unknown' };
        }));
        res.json(petsWithOwnerNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all pets (potentially for admin or other purposes)
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

// Delete Pet by ID
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
            userId: pet.owner, // Assuming owner field exists on pet schema
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

// Update Pet by ID
router.put('/:id', async (req, res) => {
    try {
        // Ensure numeric fields are numbers if they exist in the body
        const updateData = { ...req.body };
        if (updateData.ageYears !== undefined && updateData.ageYears !== null) {
             updateData.ageYears = Number(updateData.ageYears);
             if (isNaN(updateData.ageYears) || updateData.ageYears < 0) {
                 return res.status(400).json({ message: 'Invalid age in years provided for update.' });
             }
        }
        if (updateData.ageMonths !== undefined && updateData.ageMonths !== null) {
             updateData.ageMonths = Number(updateData.ageMonths);
             if (isNaN(updateData.ageMonths) || updateData.ageMonths < 0 || updateData.ageMonths > 11) {
                 return res.status(400).json({ message: 'Invalid age in months provided for update.' });
             }
        }
        if (updateData.weight !== undefined && updateData.weight !== null) {
             updateData.weight = Number(updateData.weight);
             if (isNaN(updateData.weight) || updateData.weight <= 0) {
                 return res.status(400).json({ message: 'Invalid weight provided for update.' });
             }
        }

        // Perform the update
        const updatedPet = await Pet.findByIdAndUpdate(req.params.id, updateData, {
             new: true, // Return the modified document
             runValidators: true // Ensure schema validators (like enum) run on update
        });

        if (!updatedPet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(updatedPet);
    } catch (error) {
        console.error("Error in /pets/:id PUT:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;

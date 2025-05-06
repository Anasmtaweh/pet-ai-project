// c:\Users\Anas\Desktop\backend\routes\pets.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const User = require('../models/User');
const Pet = require('../models/Pet');
const RecentActivity = require('../models/RecentActivity');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Utils');

// --- Multer Configuration ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        // Pass a specific error message that we can check later
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
    }
};

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});
// --- End Multer Configuration ---

// Helper function for logging activity
const logActivity = async (type, details, userId, petId = null) => {
    try {
        await RecentActivity.create({ type, details, userId, petId });
    } catch (logError) {
        console.error(`Failed to log activity (${type}):`, logError);
    }
};

// --- Refactored POST /pets/add ---
// We'll wrap the Multer middleware execution to catch its errors directly.
router.post('/add', (req, res, next) => {
    // Manually invoke the multer middleware
    upload.single('picture')(req, res, async (err) => {
        // --- Explicitly handle Multer and custom errors ---
        if (err) {
            if (err instanceof multer.MulterError) {
                // Handle specific Multer errors (like file size)
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
                }
                // Handle other potential Multer errors
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            } else if (err.message.startsWith('Invalid file type')) {
                // Handle the custom error from our fileFilter
                return res.status(400).json({ message: err.message });
            } else {
                // Handle other unexpected errors during upload middleware
                console.error("Unexpected error during file upload middleware:", err);
                return res.status(500).json({ message: 'Error processing file upload.' });
            }
        }
        // --- End error handling ---

        // If we reach here, Multer finished without errors (or no file was uploaded)
        // Now, proceed with the rest of the original route logic

        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        // --- Validation ---
        if (!name || !species || !gender || !breed || !owner) {
            console.error("Validation Failed - Missing Text Fields. Received body:", req.body);
            return res.status(400).json({ message: 'Name, species, gender, breed, and owner are required.' });
        }
        const numAgeYears = Number(ageYears);
        const numAgeMonths = Number(ageMonths);
        const numWeight = Number(weight);

        if (isNaN(numAgeYears) || numAgeYears < 0 || numAgeYears > 50) {
            return res.status(400).json({ message: 'Valid age in years (0-50) is required.' });
        }
        if (isNaN(numAgeMonths) || numAgeMonths < 0 || numAgeMonths > 11) {
            return res.status(400).json({ message: 'Valid age in months (0-11) is required.' });
        }
        if (isNaN(numWeight) || numWeight <= 0 || numWeight > 200) {
            return res.status(400).json({ message: 'Valid weight (greater than 0, max 200) is required.' });
        }
        // Adjust species validation based on your Pet model if needed
        if (!['Dog', 'Cat', /*'Bird', 'Fish', 'Reptile', 'Other'*/].includes(species)) { // Assuming only Dog/Cat based on model
            return res.status(400).json({ message: 'Invalid species provided. Only Dog or Cat allowed.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }
        // --- End Validation ---

        try {
            const ownerExists = await User.findById(owner);
            if (!ownerExists) {
                return res.status(404).json({ message: 'Owner not found.' });
            }

            let pictureUrl = null;
            let pictureKey = null;

            if (req.file) {
                console.log(`Received file: ${req.file.originalname} ${req.file.mimetype} ${req.file.size}`);
                const uniqueSuffix = crypto.randomBytes(16).toString('hex');
                const fileExtension = path.extname(req.file.originalname) || '.jpg';
                const s3Key = `uploads/pets/pet_${owner}_${uniqueSuffix}${fileExtension}`;
                console.log(`Generated S3 Key: ${s3Key}`);

                // ...
                try {
                    const uploadResult = await uploadFileToS3({
                        fileBuffer: req.file.buffer,    // CORRECTED: Use 'fileBuffer'
                        fileName: s3Key,                // CORRECTED: Use 'fileName'
                        mimetype: req.file.mimetype
                    });
                    pictureUrl = uploadResult.url;
                    pictureKey = uploadResult.key; // This should still work as s3Utils returns { key, url }
                    console.log(`Uploaded picture URL: ${pictureUrl}`);
                // ...

                } catch (uploadError) {
                    console.error("S3 Upload Error in /pets/add route:", uploadError);
                    const errMsg = uploadError.message || 'Failed to upload picture to storage.';
                    // Since Multer errors are handled above, this catch is primarily for S3 errors
                    return res.status(500).json({ message: errMsg });
                }
            } else {
                console.log("No picture file received for pet add.");
            }

            const newPet = new Pet({
                name,
                ageYears: numAgeYears,
                ageMonths: numAgeMonths,
                weight: numWeight,
                species,
                gender,
                breed,
                medicalInfo: medicalInfo || '',
                owner,
                pictures: pictureUrl ? [pictureUrl] : [],
            });

            const savedPet = await newPet.save();
            const activityDetails = `Pet added: ${savedPet.name}` + (pictureUrl ? ' with picture.' : '.');
            await logActivity('pet_added', activityDetails, owner, savedPet._id);

            res.status(201).json(savedPet);

        } catch (error) {
            console.error("Error adding pet (main logic):", error);
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Validation error', details: error.errors });
            }
            // Avoid sending response again if already sent by Multer error handler
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error adding pet' });
            }
        }
    }); // End of Multer callback
}); // End of route definition
// --- End Refactored POST /pets/add ---


// GET /pets/owner/:ownerId - Get all pets for a specific owner
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
             return res.status(400).json({ message: 'Invalid owner ID format' });
        }
        const pets = await Pet.find({ owner: ownerId }).populate('owner', 'username');
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found for this user' });
        }
        const petsWithOwnerName = pets.map(pet => ({
            ...pet.toObject(),
            ownerName: pet.owner ? pet.owner.username : 'Unknown Owner'
        }));
        res.json(petsWithOwnerName);
    } catch (error) {
        console.error("Error fetching pets by owner:", error);
        res.status(500).json({ message: 'Server error fetching pets' });
    }
});

// GET /pets/ - Get all pets
router.get('/', async (req, res) => {
    try {
        const pets = await Pet.find().populate('owner', 'username');
         if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found' });
        }
        res.json(pets);
    } catch (error) {
        console.error("Error fetching all pets:", error);
        res.status(500).json({ message: 'Server error fetching pets' });
    }
});

// GET /pets/:id - Get a specific pet by ID
router.get('/:id', async (req, res) => {
    try {
        const petId = req.params.id;
         if (!mongoose.Types.ObjectId.isValid(petId)) {
             return res.status(400).json({ message: 'Invalid pet ID format' });
        }
        const pet = await Pet.findById(petId).populate('owner', 'username');
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(pet);
    } catch (error) {
        console.error("Error fetching pet by ID:", error);
        res.status(500).json({ message: 'Server error fetching pet' });
    }
});

// DELETE /pets/:id - Delete a pet and associated S3 pictures
router.delete('/:id', async (req, res) => {
    try {
        const petId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(petId)) {
            return res.status(400).json({ message: 'Invalid pet ID format' });
        }
        const pet = await Pet.findById(petId);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        if (pet.pictures && pet.pictures.length > 0) {
            const deletePromises = pet.pictures.map(async (pictureUrl) => {
                try {
                    const url = new URL(pictureUrl);
                    const key = url.pathname.substring(1);
                    if (key) {
                        console.log(`Attempting to delete S3 object: ${key}`);
                        await deleteFileFromS3(key);
                    }
                } catch (s3Error) {
                    console.error(`Failed to delete S3 object for ${pictureUrl}:`, s3Error);
                }
            });
            await Promise.all(deletePromises);
        }

        await Pet.findByIdAndDelete(petId);
        await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, pet.owner, pet._id);
        res.json({ message: 'Pet and associated pictures deleted' });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// PUT /pets/:id - Update pet details
router.put('/:id', async (req, res) => {
    try {
        const petId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(petId)) {
            return res.status(400).json({ message: 'Invalid pet ID format' });
        }
        const { pictures, owner, ...updateData } = req.body;

        if (updateData.ageYears !== undefined) {
            updateData.ageYears = Number(updateData.ageYears);
            if (isNaN(updateData.ageYears) || updateData.ageYears < 0 || updateData.ageYears > 50) {
                return res.status(400).json({ message: 'Invalid ageYears provided for update.' });
            }
        }
        if (updateData.ageMonths !== undefined) {
            updateData.ageMonths = Number(updateData.ageMonths);
             if (isNaN(updateData.ageMonths) || updateData.ageMonths < 0 || updateData.ageMonths > 11) {
                return res.status(400).json({ message: 'Invalid ageMonths provided for update.' });
            }
        }
         if (updateData.weight !== undefined) {
            updateData.weight = Number(updateData.weight);
             if (isNaN(updateData.weight) || updateData.weight <= 0 || updateData.weight > 200) {
                return res.status(400).json({ message: 'Invalid weight provided for update.' });
            }
        }

        const updatedPet = await Pet.findByIdAndUpdate(
            petId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('owner', 'username');

        if (!updatedPet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(updatedPet);
    } catch (error) {
        console.error("Error in /pets/:id PUT:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error updating pet' });
    }
});

module.exports = router;

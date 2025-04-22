// c:\Users\Anas\M5\pet-ai-project\backend\routes\pets.js
const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer
const path = require('path'); // To get file extensions
const crypto = require('crypto'); // For unique filenames
const Pet = require('../models/Pet');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity'); // Assuming this model exists and is needed
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Utils'); // Import S3 utils

// --- Multer Configuration ---
// Store files in memory as Buffers
const storage = multer.memoryStorage();

// Filter for image files and set size limits
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit (adjust as needed)
    },
    fileFilter: (req, file, cb) => {
        // Accept only common image types
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true); // Accept file
        } else {
            // Reject file - pass an error message
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
        }
    }
});
// --- End Multer Configuration ---


// Add a new pet WITH picture upload
// Use upload.single('picture') - 'picture' must match the name attribute of the file input in the frontend form
router.post('/add', upload.single('picture'), async (req, res) => {
    try {
        // Destructure text fields from req.body (populated by multer)
        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        // --- Validation (remains largely the same) ---
        if (!name || !species || !gender || !breed || !owner) {
             console.error("Validation Failed - Missing Text Fields. Received body:", req.body);
             return res.status(400).json({ message: 'Name, species, gender, breed, and owner are required.' });
        }
        // ... (other validations for age, weight, species, gender remain the same) ...
        if (ageYears === undefined || ageYears === null || isNaN(Number(ageYears)) || Number(ageYears) < 0) {
            return res.status(400).json({ message: 'Valid age in years (0 or greater) is required.' });
        }
        if (ageMonths === undefined || ageMonths === null || isNaN(Number(ageMonths)) || Number(ageMonths) < 0 || Number(ageMonths) > 11 ) {
            return res.status(400).json({ message: 'Valid age in months (0-11) is required.' });
        }
         if (weight === undefined || weight === null || isNaN(Number(weight)) || Number(weight) <= 0) {
            return res.status(400).json({ message: 'Valid weight (greater than 0) is required.' });
        }
        if (!['Cat', 'Dog'].includes(species)) {
            return res.status(400).json({ message: 'Species must be either Cat or Dog.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }
        // --- End Validation ---

        const user = await User.findById(owner);
        if (!user) {
            return res.status(404).json({ message: 'Owner not found.' });
        }

        let pictureUrl = null; // Initialize pictureUrl
        let s3ObjectKey = null; // Store the key for potential rollback/logging

        // --- Handle File Upload to S3 ---
        if (req.file) {
            console.log("Received file:", req.file.originalname, req.file.mimetype, req.file.size);
            try {
                // Generate a unique file key for S3
                const fileExtension = path.extname(req.file.originalname);
                const uniqueFileName = `pet_${owner}_${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
                // Define the full S3 key including prefix
                s3ObjectKey = `uploads/pets/${uniqueFileName}`; // Store in uploads/pets/ prefix

                console.log(`Generated S3 Key: ${s3ObjectKey}`);

                // Upload using the updated utility function
                const s3Data = await uploadFileToS3({
                    fileBuffer: req.file.buffer,
                    fileName: s3ObjectKey, // Pass the full desired S3 key
                    mimetype: req.file.mimetype,
                });
                pictureUrl = s3Data.url; // Get the URL returned by the utility
                console.log("Uploaded picture URL:", pictureUrl);
            } catch (uploadError) {
                // Log the specific error caught from s3Utils
                console.error("S3 Upload Error in /pets/add route:", uploadError);
                // Send specific error if available, otherwise generic
                const errMsg = uploadError.message || 'Failed to upload picture to storage.';
                return res.status(500).json({ message: errMsg });
            }
        } else {
            console.log("No picture file received for pet add.");
        }
        // --- End File Upload Handling ---

        // Create new Pet - include picture URL if available
        const newPet = new Pet({
            name,
            ageYears: Number(ageYears),
            ageMonths: Number(ageMonths),
            weight: Number(weight),
            species,
            gender,
            breed,
            medicalInfo,
            owner,
            pictures: pictureUrl ? [pictureUrl] : [] // Store URL in array
        });
        await newPet.save();

        // Add recent activity only after successful save
        if (RecentActivity) { // Check if RecentActivity model was loaded
            await RecentActivity.create({
                type: 'pet_added',
                details: `New pet added: ${newPet.name}${pictureUrl ? ' with picture' : ''}`,
                userId: newPet.owner,
                petId: newPet._id,
            });
        }

        res.status(201).json(newPet);
    } catch (error) {
        console.error("Error in /pets/add:", error);
        // Handle potential multer errors (like file size limit)
        if (error instanceof multer.MulterError) {
             return res.status(400).json({ message: `File upload error: ${error.message}` });
        } else if (error.message?.includes('Invalid file type')) { // Check for custom fileFilter error
             return res.status(400).json({ message: error.message });
        } else if (error.name === 'ValidationError') {
            // Mongoose validation errors
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        // Generic server error
        res.status(500).json({ message: 'Server error adding pet.' });
    }
});

// Get all pets for a user (No changes needed)
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const pets = await Pet.find({ owner: req.params.ownerId });
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found for this user' });
        }
        const petsWithOwnerNames = await Promise.all(pets.map(async (pet) => {
            const owner = await User.findById(pet.owner);
            return { ...pet._doc, ownerName: owner ? owner.username : 'Unknown' };
        }));
        res.json(petsWithOwnerNames);
    } catch (error) {
        console.error("Error fetching pets for owner:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all pets (No changes needed)
router.get('/', async (req, res) => {
    try {
        const pets = await Pet.find({});
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found' });
        }
        res.json(pets);
    } catch (error) {
        console.error("Error fetching all pets:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete Pet by ID - WITH S3 file deletion
router.delete('/:id', async (req, res) => {
    try {
        // 1. Find the pet first to get picture details
        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        // 2. Attempt to delete associated pictures from S3
        if (pet.pictures && pet.pictures.length > 0) {
            const deletePromises = pet.pictures.map(pictureUrl => {
                try {
                    // Extract the S3 key from the URL
                    // Example URL: https://bucket-name.s3.region.amazonaws.com/uploads/pets/pet_ownerid_hash.png
                    const url = new URL(pictureUrl);
                    const key = url.pathname.substring(1); // Remove leading '/' -> uploads/pets/pet_ownerid_hash.png
                    if (key) {
                        console.log(`Attempting to delete S3 object: ${key}`);
                        return deleteFileFromS3(key); // Call utility function
                    }
                } catch (urlError) {
                    console.error(`Invalid picture URL format, cannot delete from S3: ${pictureUrl}`, urlError);
                }
                return Promise.resolve(); // Resolve promise even if URL is bad/deletion fails to avoid breaking Promise.all
            });
            await Promise.all(deletePromises); // Wait for all deletions to attempt
        }

        // 3. Delete the pet document from MongoDB
        await Pet.findByIdAndDelete(req.params.id);

        // 4. Add recent activity (Check if model exists)
        if (RecentActivity) {
            await RecentActivity.create({
                type: 'pet_deleted',
                details: `Pet deleted: ${pet.name}`,
                userId: pet.owner, // Assuming owner field exists on pet schema
                petId: pet._id,
            });
        }

        res.json({ message: 'Pet and associated pictures deleted' });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// Get Pet by ID (No changes needed)
router.get('/:id', async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(pet);
    } catch (error) {
        console.error("Error fetching pet by ID:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Pet by ID (No file handling here - keep simple)
// Picture updates should ideally be handled by a separate endpoint (e.g., POST /pets/:id/picture)
router.put('/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        // Remove pictures field if sent, as we don't handle file updates here
        delete updateData.pictures;

        // Ensure numeric fields are numbers if they exist
        // ... (numeric validation remains the same) ...
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
        res.status(500).json({ message: 'Server error updating pet details' });
    }
});


module.exports = router;
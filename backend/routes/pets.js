// c:\Users\Anas\M5\pet-ai-project\backend\routes\pets.js
const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');
const multer = require('multer'); // Import multer
const { uploadFileToS3, deleteFilesFromS3 } = require('../utils/s3Utils'); // Import S3 utils

// Configure Multer (store files in memory buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => { // Basic image filter
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Accept file
        } else {
            // Reject file and pass an error
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// --- Add Pet Route (Handles File Uploads) ---
// Use multer middleware 'upload.array()' to handle multiple files under the 'pictures' field name
router.post('/add', upload.array('pictures', 5), async (req, res) => { // Max 5 pictures
    try {
        // Text fields are in req.body
        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        // --- Validation ---
        // Check required fields (ensure numbers are checked for existence, not just truthiness)
        if (!name || ageYears === undefined || ageMonths === undefined || weight === undefined || !species || !gender || !breed || !owner) {
            return res.status(400).json({ message: 'Name, ageYears, ageMonths, weight, species, gender, breed, and owner are required.' });
        }
        // Add specific number validations if needed (e.g., non-negative)
        if (Number(ageYears) < 0 || Number(ageMonths) < 0 || Number(ageMonths) > 11 || Number(weight) <= 0) {
             return res.status(400).json({ message: 'Invalid age or weight values.' });
        }
        if (!['Cat', 'Dog'].includes(species)) {
            return res.status(400).json({ message: 'Species must be either Cat or Dog.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }
        // --- End Validation ---

        // Check if owner exists
        const user = await User.findById(owner);
        if (!user) {
            return res.status(404).json({ message: 'Owner not found.' });
        }

        // --- Handle File Uploads to S3 ---
        let pictureUrls = [];
        // Files uploaded by multer are in req.files array
        if (req.files && req.files.length > 0) {
            console.log(`Received ${req.files.length} files to upload.`);
            try {
                // Upload each file to S3 concurrently
                pictureUrls = await Promise.all(
                    req.files.map(file =>
                        uploadFileToS3(file.buffer, file.originalname, file.mimetype)
                    )
                );
                console.log("Uploaded Picture URLs:", pictureUrls);
            } catch (uploadError) {
                // If any S3 upload fails, send specific error
                console.error("S3 Upload failed during pet add:", uploadError);
                // Use the error message from s3Utils if available
                return res.status(500).json({ message: uploadError.message || 'Failed to upload one or more pictures to S3.' });
            }
        } else {
            console.log("No picture files received.");
        }
        // --- End File Handling ---

        // --- Create and Save New Pet ---
        const newPet = new Pet({
            name,
            ageYears: Number(ageYears), // Ensure stored as numbers
            ageMonths: Number(ageMonths),
            weight: Number(weight),
            species,
            gender,
            breed,
            medicalInfo,
            owner,
            pictures: pictureUrls // Save the array of S3 URLs
        });
        await newPet.save(); // Mongoose validation (including enums) runs here

        // --- Add Recent Activity ---
        await RecentActivity.create({
            type: 'pet_added',
            details: `New pet added: ${newPet.name}`,
            userId: newPet.owner,
            petId: newPet._id,
        });

        res.status(201).json(newPet); // Respond with the created pet data

    } catch (error) {
        console.error("Error in POST /pets/add:", error);
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        // Handle multer errors (like file size limit or file type)
        if (error instanceof multer.MulterError) {
             return res.status(400).json({ message: `File upload error: ${error.message}` });
        }
        // Handle fileFilter errors explicitly passed
        if (error.message === 'Only image files are allowed!') {
             return res.status(400).json({ message: error.message });
        }
        // Generic server error
        res.status(500).json({ message: 'Server error processing request' });
    }
});

// --- Get all pets for a specific user ---
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const pets = await Pet.find({ owner: req.params.ownerId });
        // No need to fetch owner names separately if not required by frontend here
        // If pets array is empty, find returns [], which is valid JSON
        res.json(pets);
    } catch (error) {
        console.error(`Error fetching pets for owner ${req.params.ownerId}:`, error);
        res.status(500).json({ message: 'Server error fetching pets' });
    }
});

// --- Get all pets (Potentially for Admin - consider adding adminMiddleware later if needed) ---
router.get('/', async (req, res) => {
    try {
        const pets = await Pet.find({}); // Fetch all pets
        res.json(pets);
    } catch (error) {
        console.error("Error fetching all pets:", error);
        res.status(500).json({ message: 'Server error fetching all pets' });
    }
});

// --- Delete Pet (Handles S3 Deletion) ---
router.delete('/:id', async (req, res) => {
    try {
        const petId = req.params.id;

        // Find the pet first to get picture URLs before deleting the document
        const pet = await Pet.findById(petId);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        // --- Delete S3 Objects ---
        // Check if there are pictures associated with the pet
        if (pet.pictures && pet.pictures.length > 0) {
            console.log(`Attempting to delete ${pet.pictures.length} S3 objects for pet ${petId}`);
            // Call the S3 delete utility function
            // We await it, but don't necessarily stop the pet deletion if S3 fails
            await deleteFilesFromS3(pet.pictures);
        } else {
            console.log(`No S3 objects to delete for pet ${petId}`);
        }
        // --- End S3 Deletion ---

        // Now delete the pet document from MongoDB
        await Pet.findByIdAndDelete(petId);

        // --- Add Recent Activity ---
        await RecentActivity.create({
            type: 'pet_deleted',
            details: `Pet deleted: ${pet.name}`,
            userId: pet.owner, // Assuming owner field is populated or available
            petId: pet._id,
        });

        res.json({ message: 'Pet deleted successfully' });
    } catch (error) {
        console.error(`Error deleting pet ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// --- Get Pet by ID ---
router.get('/:id', async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(pet);
    } catch (error) {
        console.error(`Error fetching pet ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error fetching pet' });
    }
});

// --- Update Pet (Pictures NOT handled in this version) ---
// Use upload.none() because this route doesn't process file uploads
router.put('/:id', upload.none(), async (req, res) => {
    try {
        console.log(`Updating pet ${req.params.id} with data:`, req.body);
        // req.body contains the updated text fields (name, age, gender, etc.)
        const updatedPet = await Pet.findByIdAndUpdate(req.params.id, req.body, {
             new: true, // Return the updated document
             runValidators: true // Ensure schema validators (like enum) run on update
        });
        if (!updatedPet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        res.json(updatedPet); // Respond with the updated pet data
    } catch (error) {
        console.error(`Error updating pet ${req.params.id}:`, error);
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        // Generic server error
        res.status(500).json({ message: 'Server error updating pet' });
    }
});

module.exports = router;


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

const rateLimit = require('express-rate-limit');
// Limit to 100 requests per 15 minutes per IP for "get all pets" endpoint

// Rate limiter for deleting pets: max 10 deletes per 15 minutes per IP
const deletePetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many pet deletions from this IP, please try again later.'
});
// Limit to 100 requests per 15 minutes per IP for "get pet by ID" endpoint
const getPetByIdLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
});
const getAllPetsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// --- Multer Configuration for File Uploads ---
// Maximum allowed file size for pet pictures (5MB).
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Array of allowed MIME types for pet pictures.
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Filter function for Multer to validate uploaded file types.
const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file.
    } else {
        // Reject the file with a specific error message.
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
    }
};

// Configure Multer to store uploaded files in memory.
// This allows processing the file buffer before sending it to S3.
const storage = multer.memoryStorage();
// Initialize Multer with the defined storage, file filter, and size limits.
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

// Helper function for logging recent activities related to pets.
const logActivity = async (type, details, userId, petId = null) => {
    try {
        await RecentActivity.create({ type, details, userId, petId });
    } catch (logError) {
        console.error(`Failed to log activity (${type}):`, logError);
    }
};

// Route to add a new pet. Handles form data and optional picture upload.
// POST /pets/add
router.post('/add', (req, res, next) => {
    // Use Multer middleware to handle a single file upload with the field name 'picture'.
    upload.single('picture')(req, res, async (err) => {
        // Handle potential errors from Multer (e.g., file size limit, invalid file type).
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
                }
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            } else if (err.message.startsWith('Invalid file type')) {
                return res.status(400).json({ message: err.message });
            } else {
                console.error("Unexpected error during file upload middleware (POST /add):", err);
                return res.status(500).json({ message: 'Error processing file upload.' });
            }
        }

        // Destructure pet details from the request body.
        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        // Validate required fields.
        if (!name || !species || !gender || !breed || !owner) {
            return res.status(400).json({ message: 'Name, species, gender, breed, and owner are required.' });
        }
        // Convert numeric fields from string to number and validate them.
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
        // Validate enum fields (species, gender).
        if (!['Dog', 'Cat'].includes(species)) {
            return res.status(400).json({ message: 'Invalid species provided. Only Dog or Cat allowed.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }

        try {
            // Check if the specified owner exists.
            if (typeof owner !== "string" || !owner.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ message: 'Invalid owner ID format.' });
            }
            const ownerExists = await User.findById(owner);
            if (!ownerExists) {
                return res.status(404).json({ message: 'Owner not found.' });
            }

            let pictureUrl = null;

            // If a picture file was uploaded, process and upload it to S3.
            if (req.file) {
                // Generate a unique S3 key for the uploaded file.
                const uniqueSuffix = crypto.randomBytes(16).toString('hex');
                const fileExtension = path.extname(req.file.originalname) || '.jpg'; // Default to .jpg if no extension.
                const s3Key = `uploads/pets/pet_${owner}_${uniqueSuffix}${fileExtension}`;

                try {
                    // Upload the file buffer to S3.
                    const uploadResult = await uploadFileToS3({
                        fileBuffer: req.file.buffer,
                        fileName: s3Key,
                        mimetype: req.file.mimetype
                    });
                    pictureUrl = uploadResult.url; // Store the S3 URL of the uploaded picture.
                } catch (uploadError) {
                    console.error("S3 Upload Error in /pets/add route:", uploadError);
                    return res.status(500).json({ message: uploadError.message || 'Failed to upload picture to storage.' });
                }
            }

            // Create a new Pet document with the provided details and picture URL.
            const newPet = new Pet({
                name,
                ageYears: numAgeYears,
                ageMonths: numAgeMonths,
                weight: numWeight,
                species,
                gender,
                breed,
                medicalInfo: medicalInfo || '', // Default to empty string if not provided.
                owner,
                pictures: pictureUrl ? [pictureUrl] : [], // Store picture URL in an array.
            });

            const savedPet = await newPet.save(); // Save the new pet to the database.
            // Log the pet addition activity.
            const activityDetails = `Pet added: ${savedPet.name}` + (pictureUrl ? ' with picture.' : '.');
            await logActivity('pet_added', activityDetails, owner, savedPet._id);

            res.status(201).json(savedPet); // Respond with the newly created pet document.

        } catch (error) {
            console.error("Error adding pet (main logic):", error);
            // Handle Mongoose validation errors.
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Validation error', details: error.errors });
            }
            // Ensure response is sent only once in case of multiple error paths.
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error adding pet' });
            }
        }
    });
});

// Route to get all pets belonging to a specific owner.
// GET /pets/owner/:ownerId
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        // Validate the ownerId format.
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
             return res.status(400).json({ message: 'Invalid owner ID format' });
        }
        // Find pets by owner ID and populate the owner's username.
        const pets = await Pet.find({ owner: ownerId }).populate('owner', 'username');
        if (!pets || pets.length === 0) {
            return res.status(404).json({ message: 'No pets found for this user' });
        }
        // Map pets to include ownerName in the response.
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

// Route to get all pets in the system.
// GET /pets/
router.get('/', getAllPetsLimiter, async (req, res) => {
    try {
        // Find all pets and populate their owner's username.
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

// Route to get a specific pet by its ID.
// GET /pets/:id
router.get('/:id', getPetByIdLimiter, async (req, res) => {
    try {
        const petId = req.params.id;
        // Validate the petId format.
         if (!mongoose.Types.ObjectId.isValid(petId)) {
             return res.status(400).json({ message: 'Invalid pet ID format' });
        }
        // Find the pet by ID and populate its owner's username.
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

// Route to delete a pet and its associated pictures from S3.
// DELETE /pets/:id
router.delete('/:id', deletePetLimiter, async (req, res) => {
    try {
        const petId = req.params.id;
        // Validate the petId format.
        if (!mongoose.Types.ObjectId.isValid(petId)) {
            return res.status(400).json({ message: 'Invalid pet ID format' });
        }
        // Find the pet to be deleted.
        const pet = await Pet.findById(petId);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }

        // If the pet has pictures, delete them from S3.
        if (pet.pictures && pet.pictures.length > 0) {
            const deletePromises = pet.pictures.map(async (pictureUrl) => {
                try {
                    // Extract the S3 key from the picture URL.
                    const url = new URL(pictureUrl);
                    const key = url.pathname.substring(1); // Remove leading '/'.
                    if (key) {
                        await deleteFileFromS3(key); // Delete the file from S3.
                    }
                } catch (s3Error) {
                    console.error(`Failed to delete S3 object for ${pictureUrl}:`, s3Error);
                    // Decide whether to halt or continue if S3 deletion fails.
                }
            });
            await Promise.all(deletePromises); // Wait for all S3 deletions to complete.
        }

        await Pet.findByIdAndDelete(petId); // Delete the pet document from the database.
        // Log the pet deletion activity.
        if (pet.owner) {
            await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, pet.owner, pet._id);
        } else {
            // Log a warning if owner information is missing for the activity log.
            console.warn(`Pet ${pet._id} deleted, but owner information was missing for activity log.`);
        }
        res.json({ message: 'Pet and associated pictures deleted' });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// Route to update pet details, including optional picture update.
// PUT /pets/:id
router.put('/:id', (req, res, next) => {
    // Use Multer middleware for handling a single file upload with field name 'picture'.
    upload.single('picture')(req, res, async (err) => {
        // Handle potential errors from Multer.
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
                }
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            } else if (err.message.startsWith('Invalid file type')) {
                return res.status(400).json({ message: err.message });
            } else {
                console.error("Unexpected error during file upload middleware (PUT /:id):", err);
                return res.status(500).json({ message: 'Error processing file upload.' });
            }
        }

        try {
            const petId = req.params.id;
            // Validate the petId format.
            if (!mongoose.Types.ObjectId.isValid(petId)) {
                return res.status(400).json({ message: 'Invalid pet ID format' });
            }

            const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo } = req.body;
            const updateData = {}; // Object to hold fields to be updated.

            // Validate and prepare text fields for update if they are provided in the request.
            if (name !== undefined) {
                if (!name.trim()) return res.status(400).json({ message: 'Pet name cannot be empty if provided.' });
                updateData.name = name.trim();
            }
            if (ageYears !== undefined) {
                const numAgeYears = Number(ageYears);
                if (isNaN(numAgeYears) || numAgeYears < 0 || numAgeYears > 50) {
                    return res.status(400).json({ message: 'Valid age in years (0-50) is required for update.' });
                }
                updateData.ageYears = numAgeYears;
            }
            if (ageMonths !== undefined) {
                const numAgeMonths = Number(ageMonths);
                if (isNaN(numAgeMonths) || numAgeMonths < 0 || numAgeMonths > 11) {
                    return res.status(400).json({ message: 'Valid age in months (0-11) is required for update.' });
                }
                updateData.ageMonths = numAgeMonths;
            }
            if (weight !== undefined) {
                const numWeight = Number(weight);
                if (isNaN(numWeight) || numWeight <= 0 || numWeight > 200) {
                    return res.status(400).json({ message: 'Valid weight (0.1-200) is required for update.' });
                }
                updateData.weight = numWeight;
            }
            if (species !== undefined) {
                if (!['Dog', 'Cat'].includes(species)) {
                    return res.status(400).json({ message: 'Invalid species. Only Dog or Cat allowed.' });
                }
                updateData.species = species;
            }
            if (gender !== undefined) {
                 if (!['Male', 'Female'].includes(gender)) {
                    return res.status(400).json({ message: 'Gender must be Male or Female.' });
                }
                updateData.gender = gender;
            }
            if (breed !== undefined) {
                if (!breed.trim()) return res.status(400).json({ message: 'Breed cannot be empty if provided.' });
                updateData.breed = breed.trim();
            }
            if (medicalInfo !== undefined) { // medicalInfo can be an empty string.
                updateData.medicalInfo = medicalInfo.trim();
            }

            // Find the pet to be updated.
            const petToUpdate = await Pet.findById(petId);
            if (!petToUpdate) {
                return res.status(404).json({ message: 'Pet not found' });
            }

            // Handle picture update if a new picture file is provided.
            if (req.file) {
                // 1. Delete the old picture from S3 if it exists.
                if (petToUpdate.pictures && petToUpdate.pictures.length > 0) {
                    const oldPictureUrl = petToUpdate.pictures[0]; // Assuming only one picture per pet for now.
                    try {
                        const url = new URL(oldPictureUrl);
                        const oldS3Key = url.pathname.substring(1);
                        if (oldS3Key) {
                            await deleteFileFromS3(oldS3Key);
                        }
                    } catch (s3DeleteError) {
                        console.error(`Failed to delete old S3 object ${oldPictureUrl}:`, s3DeleteError);
                        // Log and continue, or decide if this should be a fatal error.
                    }
                }

                // 2. Upload the new picture to S3.
                const ownerIdForS3Key = petToUpdate.owner ? petToUpdate.owner.toString() : 'unknown_owner';
                const uniqueSuffix = crypto.randomBytes(16).toString('hex');
                const fileExtension = path.extname(req.file.originalname) || '.jpg';
                const s3Key = `uploads/pets/pet_${ownerIdForS3Key}_${uniqueSuffix}${fileExtension}`;

                try {
                    const uploadResult = await uploadFileToS3({
                        fileBuffer: req.file.buffer,
                        fileName: s3Key,
                        mimetype: req.file.mimetype
                    });
                    updateData.pictures = [uploadResult.url]; // Update the pictures array with the new URL.
                } catch (uploadError) {
                    console.error("S3 Upload Error in /pets/:id (PUT):", uploadError);
                    return res.status(500).json({ message: uploadError.message || 'Failed to upload new picture.' });
                }
            }

            // If no text fields or picture were provided for update, return the current pet data.
            if (Object.keys(updateData).length === 0 && !req.file) {
                return res.status(200).json({ message: 'No changes provided.', pet: petToUpdate });
            }

            // Perform the update in the database.
            const updatedPet = await Pet.findByIdAndUpdate(
                petId,
                { $set: updateData }, // Use $set to update only the provided fields.
                { new: true, runValidators: true } // Options: return the updated document and run schema validators.
            ).populate('owner', 'username'); // Populate owner info in the response.

            if (!updatedPet) {
                // This case should ideally be caught by petToUpdate check, but as a safeguard.
                return res.status(404).json({ message: 'Pet not found after update attempt.' });
            }
            // Consider logging pet update activity here if needed.
            // await logActivity('pet_updated', `Pet details updated: ${updatedPet.name}`, updatedPet.owner, updatedPet._id);
            res.json(updatedPet);

        } catch (error) {
            console.error("Error in /pets/:id PUT (main logic):", error);
            // Handle Mongoose validation errors.
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Validation error during update.', details: error.errors });
            }
            // Avoid sending response again if already sent by Multer error handler.
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error updating pet' });
            }
        }
    });
});

module.exports = router;



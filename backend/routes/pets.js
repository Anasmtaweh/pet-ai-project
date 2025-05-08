// c:\Users\Anas\M5\pet-ai-project\backend\routes\pets.js

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

// --- Multer Configuration  ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
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

// --- POST /pets/add (No changes from your provided version, kept for context) ---
router.post('/add', (req, res, next) => {
    upload.single('picture')(req, res, async (err) => {
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

        const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo, owner } = req.body;

        if (!name || !species || !gender || !breed || !owner) {
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
        if (!['Dog', 'Cat'].includes(species)) {
            return res.status(400).json({ message: 'Invalid species provided. Only Dog or Cat allowed.' });
        }
        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be either Male or Female.' });
        }

        try {
            const ownerExists = await User.findById(owner);
            if (!ownerExists) {
                return res.status(404).json({ message: 'Owner not found.' });
            }

            let pictureUrl = null;
            // let pictureKey = null; // Not directly used after uploadResult in this version

            if (req.file) {
                console.log(`Received file for add: ${req.file.originalname}`);
                const uniqueSuffix = crypto.randomBytes(16).toString('hex');
                const fileExtension = path.extname(req.file.originalname) || '.jpg';
                const s3Key = `uploads/pets/pet_${owner}_${uniqueSuffix}${fileExtension}`;
                console.log(`Generated S3 Key for add: ${s3Key}`);

                try {
                    const uploadResult = await uploadFileToS3({
                        fileBuffer: req.file.buffer,
                        fileName: s3Key,
                        mimetype: req.file.mimetype
                    });
                    pictureUrl = uploadResult.url;
                    // pictureKey = uploadResult.key;
                    console.log(`Uploaded picture URL for add: ${pictureUrl}`);
                } catch (uploadError) {
                    console.error("S3 Upload Error in /pets/add route:", uploadError);
                    return res.status(500).json({ message: uploadError.message || 'Failed to upload picture to storage.' });
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
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error adding pet' });
            }
        }
    });
});
// --- End POST /pets/add ---


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
                    const key = url.pathname.substring(1); // Remove leading '/'
                    if (key) {
                        console.log(`Attempting to delete S3 object: ${key}`);
                        await deleteFileFromS3(key);
                    }
                } catch (s3Error) {
                    console.error(`Failed to delete S3 object for ${pictureUrl}:`, s3Error);
                    // Log and continue, or decide if this should be a fatal error for the delete op
                }
            });
            await Promise.all(deletePromises);
        }

        await Pet.findByIdAndDelete(petId);
        // Log activity (ensure pet.owner is available or handle if not)
        if (pet.owner) {
            await logActivity('pet_deleted', `Pet deleted: ${pet.name}`, pet.owner, pet._id);
        } else {
            console.warn(`Pet ${pet._id} deleted, but owner information was missing for activity log.`);
        }
        res.json({ message: 'Pet and associated pictures deleted' });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ message: 'Server error deleting pet' });
    }
});

// --- MODIFIED PUT /pets/:id - Update pet details (NOW WITH PICTURE UPDATE CAPABILITY) ---
router.put('/:id', (req, res, next) => {
    upload.single('picture')(req, res, async (err) => {
        // --- Multer Error Handling ---
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
        // --- End Multer Error Handling ---

        try {
            const petId = req.params.id;
            if (!mongoose.Types.ObjectId.isValid(petId)) {
                return res.status(400).json({ message: 'Invalid pet ID format' });
            }

            const { name, ageYears, ageMonths, weight, species, gender, breed, medicalInfo } = req.body;
            const updateData = {};

            // --- Validations for text fields ---
            // Only add to updateData if the field is actually provided in the request body
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
            if (medicalInfo !== undefined) { // medicalInfo can be an empty string
                updateData.medicalInfo = medicalInfo.trim();
            }
            // --- End Validations ---

            const petToUpdate = await Pet.findById(petId);
            if (!petToUpdate) {
                return res.status(404).json({ message: 'Pet not found' });
            }

            // --- Picture Handling ---
            if (req.file) {
                console.log(`New picture received for update on pet ${petId}: ${req.file.originalname}`);

                // 1. Delete old picture from S3 if it exists
                if (petToUpdate.pictures && petToUpdate.pictures.length > 0) {
                    const oldPictureUrl = petToUpdate.pictures[0]; // Assuming only one picture
                    try {
                        const url = new URL(oldPictureUrl);
                        const oldS3Key = url.pathname.substring(1); 
                        if (oldS3Key) {
                            console.log(`Attempting to delete old S3 object: ${oldS3Key}`);
                            await deleteFileFromS3(oldS3Key);
                        }
                    } catch (s3DeleteError) {
                        console.error(`Failed to delete old S3 object ${oldPictureUrl}:`, s3DeleteError);
                        // Log and continue, or return error based on strictness
                        
                    }
                }

                // 2. Upload new picture to S3
                // Ensure petToUpdate.owner is valid before using it in the key
                const ownerIdForS3Key = petToUpdate.owner ? petToUpdate.owner.toString() : 'unknown_owner';
                const uniqueSuffix = crypto.randomBytes(16).toString('hex');
                const fileExtension = path.extname(req.file.originalname) || '.jpg';
                const s3Key = `uploads/pets/pet_${ownerIdForS3Key}_${uniqueSuffix}${fileExtension}`;
                console.log(`Generated new S3 Key for update: ${s3Key}`);

                try {
                    const uploadResult = await uploadFileToS3({
                        fileBuffer: req.file.buffer,
                        fileName: s3Key,
                        mimetype: req.file.mimetype
                    });
                    updateData.pictures = [uploadResult.url]; // Update pictures array with new URL
                    console.log(`Uploaded new picture URL for update: ${uploadResult.url}`);
                } catch (uploadError) {
                    console.error("S3 Upload Error in /pets/:id (PUT):", uploadError);
                    return res.status(500).json({ message: uploadError.message || 'Failed to upload new picture.' });
                }
            }
            // --- End Picture Handling ---

            // Only update if there's something to update (text fields or picture)
            if (Object.keys(updateData).length === 0 && !req.file) {
                return res.status(200).json({ message: 'No changes provided.', pet: petToUpdate });
            }

            const updatedPet = await Pet.findByIdAndUpdate(
                petId,
                { $set: updateData },
                { new: true, runValidators: true } // runValidators is important for schema validation on update
            ).populate('owner', 'username'); // Populate owner info in the response

            if (!updatedPet) {
                // This case should ideally be caught by petToUpdate check, but as a safeguard:
                return res.status(404).json({ message: 'Pet not found after update attempt.' });
            }
           
            // await logActivity('pet_updated', `Pet details updated: ${updatedPet.name}`, updatedPet.owner, updatedPet._id);
            res.json(updatedPet);

        } catch (error) {
            console.error("Error in /pets/:id PUT (main logic):", error);
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Validation error during update.', details: error.errors });
            }
            // Avoid sending response again if already sent by Multer error handler
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error updating pet' });
            }
        }
    });
});
// --- End PUT /pets/:id ---

module.exports = router;


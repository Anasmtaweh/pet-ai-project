// c:\Users\Anas\Desktop\backend\__tests__\routes\pets.test.js

// --- Mock s3Utils FIRST ---
const mockUploadUrl = 'https://mock-bucket.s3.mock-region.amazonaws.com/mock-uploads/pets/mock-pet-pic.jpg';
const mockS3Key = 'mock-uploads/pets/mock-pet-pic.jpg';
jest.mock('../../utils/s3Utils', () => ({
    uploadFileToS3: jest.fn().mockResolvedValue({ url: mockUploadUrl, key: mockS3Key }),
    deleteFileFromS3: jest.fn().mockResolvedValue({}), // Mock successful delete by default
}));
// --- End Mocking ---

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import app from server.js
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const RecentActivity = require('../../models/RecentActivity');
const { uploadFileToS3, deleteFileFromS3 } = require('../../utils/s3Utils'); // Import the mocks

let mongoServer;
let testUser;
let testUserId;

// --- MongoDB In-Memory Server Setup ---
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// --- Test Data Setup ---
beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Pet.deleteMany({});
    await RecentActivity.deleteMany({});
    // Reset mocks
    jest.clearAllMocks();
    // Re-apply default mock implementations if needed after reset
    uploadFileToS3.mockResolvedValue({ url: mockUploadUrl, key: mockS3Key });
    deleteFileFromS3.mockResolvedValue({});


    // Create a test user for ownership
    testUser = new User({
        email: 'petowner@test.com',
        password: 'OwnerPassword123!',
        username: 'PetOwner',
        age: 30,
    });
    await testUser.save();
    testUserId = testUser._id.toString();
});
// --- End Test Data Setup ---


// --- Pet Route Tests ---
describe('Pet Routes', () => {

    // --- POST /pets/add ---
    describe('POST /pets/add', () => {
        const validPetData = {
            name: 'Buddy',
            ageYears: '2',
            ageMonths: '6',
            weight: '15',
            species: 'Dog',
            gender: 'Male',
            breed: 'Golden Retriever',
            medicalInfo: 'Healthy',
            owner: '', // Will be set in test
        };

        beforeEach(() => {
            // Set owner ID before each test in this block
            validPetData.owner = testUserId;
        });

        it('should add a new pet with a picture', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('medicalInfo', validPetData.medicalInfo)
                .field('owner', validPetData.owner)
                .attach('picture', Buffer.from('fake image data'), 'buddy.jpg'); // Attach a fake file

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body.name).toBe(validPetData.name);
            expect(response.body.owner.toString()).toBe(testUserId);
            expect(response.body.pictures).toHaveLength(1);
            expect(response.body.pictures[0]).toBe(mockUploadUrl); // Check if the mocked URL is stored

            // Verify S3 upload was called
            expect(uploadFileToS3).toHaveBeenCalledTimes(1);
            expect(uploadFileToS3).toHaveBeenCalledWith(expect.objectContaining({
                mimetype: 'image/jpeg', // Multer detects based on filename/buffer
            }));

            // Verify DB
            const dbPet = await Pet.findById(response.body._id);
            expect(dbPet).not.toBeNull();
            expect(dbPet.pictures[0]).toBe(mockUploadUrl);

            // Verify Recent Activity
            const activity = await RecentActivity.findOne({ petId: response.body._id, type: 'pet_added' });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain('with picture');
        });

        it('should add a new pet without a picture', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner);
                // No .attach() call

            expect(response.statusCode).toBe(201);
            expect(response.body.name).toBe(validPetData.name);
            expect(response.body.pictures).toEqual([]); // Pictures array should be empty

            // Verify S3 upload was NOT called
            expect(uploadFileToS3).not.toHaveBeenCalled();

            // Verify DB
            const dbPet = await Pet.findById(response.body._id);
            expect(dbPet).not.toBeNull();
            expect(dbPet.pictures).toEqual([]);

             // Verify Recent Activity
            const activity = await RecentActivity.findOne({ petId: response.body._id, type: 'pet_added' });
            expect(activity).not.toBeNull();
            expect(activity.details).not.toContain('with picture');
        });

        it('should return 400 for missing required fields', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', 'Buddy')
                // Missing species, gender, breed, owner etc.
                .field('ageYears', '1')
                .field('ageMonths', '1')
                .field('weight', '10');

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Name, species, gender, breed, and owner are required/i);
        });

        it('should return 400 for invalid numeric fields', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', '-1') // Invalid age
                .field('ageMonths', '6')
                .field('weight', '15')
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Valid age in years/i);
        });

         it('should return 400 for invalid enum fields (gender)', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', 'Unknown') // Invalid gender
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Gender must be either Male or Female/i);
        });

        it('should return 404 if owner does not exist', async () => {
            const nonExistentOwnerId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', nonExistentOwnerId); // Use non-existent ID

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Owner not found.');
        });

        it('should return 400 for invalid file type', async () => {
             const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner)
                .attach('picture', Buffer.from('fake text file'), 'document.txt'); // Attach non-image file

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Invalid file type/i);
            expect(uploadFileToS3).not.toHaveBeenCalled(); // S3 upload should not be attempted
        });

        it('should return 500 if S3 upload fails', async () => {
            // Configure mock to reject for this specific test
            uploadFileToS3.mockRejectedValueOnce(new Error('S3 Simulatd Error'));

            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner)
                .attach('picture', Buffer.from('fake image data'), 'fail.jpg');

            expect(response.statusCode).toBe(500);
            expect(response.body.message).toMatch(/Failed to upload picture|S3 Simulatd Error/i);
            expect(uploadFileToS3).toHaveBeenCalledTimes(1);

            // Verify pet was NOT created in DB on S3 failure
            const pets = await Pet.find({ name: validPetData.name });
            expect(pets.length).toBe(0);
        });
    });

    // --- GET /pets/owner/:ownerId ---
    describe('GET /pets/owner/:ownerId', () => {
        let pet1, pet2;
        beforeEach(async () => {
            // Create pets for the test user
            pet1 = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
            pet2 = await Pet.create({ name: 'Lucy', ageYears: 1, ageMonths: 5, weight: 4, species: 'Cat', gender: 'Female', breed: 'Siamese', owner: testUserId });
        });

        it('should return all pets for a valid owner ID', async () => {
            const response = await request(app).get(`/pets/owner/${testUserId}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body[0].name).toBe(pet1.name);
            expect(response.body[1].name).toBe(pet2.name);
            expect(response.body[0]).toHaveProperty('ownerName', testUser.username); // Check ownerName added by route
        });

        it('should return 404 if no pets found for the owner', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).get(`/pets/owner/${otherUserId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('No pets found for this user');
        });
    });

    // --- GET /pets/ ---
    describe('GET /pets/', () => {
         it('should return all pets in the database', async () => {
            // Create pets for different owners
            await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
            const otherUser = await User.create({ email: 'other@test.com', password: 'Password1!', username: 'Other', age: 40 });
            await Pet.create({ name: 'Milo', ageYears: 3, ageMonths: 0, weight: 5, species: 'Cat', gender: 'Male', breed: 'Tabby', owner: otherUser._id });

            const response = await request(app).get('/pets/');

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
        });

         it('should return 404 if no pets exist', async () => {
            const response = await request(app).get('/pets/');
            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('No pets found');
        });
    });

    // --- GET /pets/:id ---
    describe('GET /pets/:id', () => {
        let testPet;
        beforeEach(async () => {
            testPet = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
        });

        it('should return a specific pet by ID', async () => {
            const response = await request(app).get(`/pets/${testPet._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body._id).toBe(testPet._id.toString());
            expect(response.body.name).toBe(testPet.name);
        });

        it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).get(`/pets/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
        });
    });

    // --- DELETE /pets/:id ---
    describe('DELETE /pets/:id', () => {
        let petToDelete;
        beforeEach(async () => {
            petToDelete = await Pet.create({
                name: 'ToDelete', ageYears: 1, ageMonths: 0, weight: 10, species: 'Dog', gender: 'Female', breed: 'Poodle', owner: testUserId,
                pictures: [mockUploadUrl] // Add a picture URL to test S3 deletion
            });
        });

        it('should delete a pet and its S3 picture', async () => {
            const response = await request(app).delete(`/pets/${petToDelete._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Pet and associated pictures deleted');

            // Verify DB deletion
            expect(await Pet.findById(petToDelete._id)).toBeNull();

            // Verify S3 deletion was called with the correct key
            expect(deleteFileFromS3).toHaveBeenCalledTimes(1);
            // Extract key from URL (remove hostname and leading slash)
            const expectedKey = new URL(mockUploadUrl).pathname.substring(1);
            expect(deleteFileFromS3).toHaveBeenCalledWith(expectedKey);

            // Verify Recent Activity
            const activity = await RecentActivity.findOne({ petId: petToDelete._id, type: 'pet_deleted' });
            expect(activity).not.toBeNull();
        });

        it('should delete a pet without pictures', async () => {
             // Create a pet without pictures
             const petNoPic = await Pet.create({ name: 'NoPic', ageYears: 1, ageMonths: 0, weight: 10, species: 'Dog', gender: 'Female', breed: 'Poodle', owner: testUserId });
             const response = await request(app).delete(`/pets/${petNoPic._id}`);

             expect(response.statusCode).toBe(200);
             expect(response.body.message).toBe('Pet and associated pictures deleted');
             expect(await Pet.findById(petNoPic._id)).toBeNull();
             expect(deleteFileFromS3).not.toHaveBeenCalled(); // S3 delete should NOT be called
        });

        it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).delete(`/pets/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
            expect(deleteFileFromS3).not.toHaveBeenCalled();
        });

        it('should proceed with DB deletion even if S3 deletion fails', async () => {
            // Configure S3 delete mock to fail
            deleteFileFromS3.mockRejectedValueOnce(new Error('S3 Delete Failed'));

            const response = await request(app).delete(`/pets/${petToDelete._id}`);

            // The route currently catches S3 errors and proceeds, so expect 200
            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Pet and associated pictures deleted');

            // Verify DB deletion still happened
            expect(await Pet.findById(petToDelete._id)).toBeNull();

            // Verify S3 deletion was attempted
            expect(deleteFileFromS3).toHaveBeenCalledTimes(1);
        });
    });

    // --- PUT /pets/:id ---
    describe('PUT /pets/:id', () => {
         let petToUpdate;
         beforeEach(async () => {
            petToUpdate = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
         });

         it('should update pet details successfully', async () => {
            const updates = {
                name: 'Buddy Updated',
                weight: '13.5', // Send as string like form data
                medicalInfo: 'Now on allergy meds'
            };
            const response = await request(app)
                .put(`/pets/${petToUpdate._id}`)
                .send(updates);

            expect(response.statusCode).toBe(200);
            expect(response.body._id).toBe(petToUpdate._id.toString());
            expect(response.body.name).toBe(updates.name);
            expect(response.body.weight).toBe(13.5); // Check conversion to number
            expect(response.body.medicalInfo).toBe(updates.medicalInfo);

            // Verify DB
            const dbPet = await Pet.findById(petToUpdate._id);
            expect(dbPet.name).toBe(updates.name);
            expect(dbPet.weight).toBe(13.5);
         });

         it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const updates = { name: 'Ghost Pet' };
            const response = await request(app)
                .put(`/pets/${invalidId}`)
                .send(updates);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
         });

         it('should return 400 for invalid update data (e.g., negative weight)', async () => {
            const updates = { weight: '-5' };
            const response = await request(app)
               .put(`/pets/${petToUpdate._id}`)
               .send(updates);

            expect(response.statusCode).toBe(400);
            // The route returns a specific message for this custom validation
            expect(response.body.message).toBe('Valid weight (0.1-200) is required for update.'); // <<< CORRECTED LINE
        });


        it('should return 400 for invalid enum update (e.g., species)', async () => {
            const updates = { species: 'Fish' }; // Invalid species
            const response = await request(app)
               .put(`/pets/${petToUpdate._id}`)
               .send(updates);

            expect(response.statusCode).toBe(400);
            // The route returns a specific message for this custom validation before Mongoose validation
            expect(response.body.message).toBe('Invalid species. Only Dog or Cat allowed.'); // <<< CORRECTED LINE
            // The .details field will not be present for this specific custom error message
        });


         it('should ignore pictures field in update payload', async () => {
             const updates = {
                 name: 'Buddy Updated Again',
                 pictures: ['http://new-hacked-url.com/pic.jpg'] // Attempt to update pictures
             };
             const response = await request(app)
                .put(`/pets/${petToUpdate._id}`)
                .send(updates);

             expect(response.statusCode).toBe(200);
             expect(response.body.name).toBe(updates.name);
             expect(response.body.pictures).toEqual([]); // Pictures should remain unchanged (empty in this case)

             // Verify DB
             const dbPet = await Pet.findById(petToUpdate._id);
             expect(dbPet.pictures).toEqual([]);
         });
    });

});

// Test suite for the /pets routes, covering pet creation, retrieval, update, and deletion.

// Mock s3Utils BEFORE other imports that might use it.
// This ensures that any module importing s3Utils gets the mocked version.
const mockUploadUrl = 'https://mock-bucket.s3.mock-region.amazonaws.com/mock-uploads/pets/mock-pet-pic.jpg';
const mockS3Key = 'mock-uploads/pets/mock-pet-pic.jpg';
jest.mock('../../utils/s3Utils', () => ({
    uploadFileToS3: jest.fn().mockResolvedValue({ url: mockUploadUrl, key: mockS3Key }),
    deleteFileFromS3: jest.fn().mockResolvedValue({}), // Mock successful delete by default
}));

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

// Setup for the test environment: runs once before all tests in this file.
beforeAll(async () => {
    // Start an in-memory MongoDB server for isolated testing.
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    // Disconnect any existing Mongoose connection and connect to the in-memory server.
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
});

// Teardown for the test environment: runs once after all tests in this file.
afterAll(async () => {
    // Disconnect Mongoose and stop the in-memory MongoDB server.
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Setup initial test data and reset mocks before each test case.
beforeEach(async () => {
    // Clear relevant collections to ensure a clean state for each test.
    await User.deleteMany({});
    await Pet.deleteMany({});
    await RecentActivity.deleteMany({});
    // Reset mocks to clear call history and previous configurations.
    jest.clearAllMocks();
    // Re-apply default mock implementations if they were cleared or changed in a previous test.
    uploadFileToS3.mockResolvedValue({ url: mockUploadUrl, key: mockS3Key });
    deleteFileFromS3.mockResolvedValue({});

    // Create a test user to be used as the owner for pets in tests.
    testUser = new User({
        email: 'petowner@test.com',
        password: 'OwnerPassword123!',
        username: 'PetOwner',
        age: 30,
    });
    await testUser.save();
    testUserId = testUser._id.toString();
});

// Test suite for all pet-related routes under /pets.
describe('Pet Routes', () => {

    // Test suite for the POST /pets/add endpoint.
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
            owner: '', // Will be set dynamically in the beforeEach hook below.
        };

        // Set the owner ID for validPetData before each test in this describe block.
        beforeEach(() => {
            validPetData.owner = testUserId;
        });

        // Test case: Verifies successful pet creation when a picture is provided.
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
                .attach('picture', Buffer.from('fake image data'), 'buddy.jpg'); // Attach a fake file for the picture.

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body.name).toBe(validPetData.name);
            expect(response.body.owner.toString()).toBe(testUserId);
            expect(response.body.pictures).toHaveLength(1);
            expect(response.body.pictures[0]).toBe(mockUploadUrl); // Check if the mocked S3 URL is stored.

            // Verify that the S3 upload function was called.
            expect(uploadFileToS3).toHaveBeenCalledTimes(1);
            expect(uploadFileToS3).toHaveBeenCalledWith(expect.objectContaining({
                mimetype: 'image/jpeg', // Multer detects mimetype based on filename/buffer.
            }));

            // Verify that the pet was correctly saved to the database.
            const dbPet = await Pet.findById(response.body._id);
            expect(dbPet).not.toBeNull();
            expect(dbPet.pictures[0]).toBe(mockUploadUrl);

            // Verify that a recent activity log was created for adding the pet.
            const activity = await RecentActivity.findOne({ petId: response.body._id, type: 'pet_added' });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain('with picture');
        });

        // Test case: Verifies successful pet creation when no picture is provided.
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
                // No .attach() call, simulating no picture upload.

            expect(response.statusCode).toBe(201);
            expect(response.body.name).toBe(validPetData.name);
            expect(response.body.pictures).toEqual([]); // Pictures array should be empty.

            // Verify S3 upload was NOT called.
            expect(uploadFileToS3).not.toHaveBeenCalled();

            // Verify pet was saved to DB with an empty pictures array.
            const dbPet = await Pet.findById(response.body._id);
            expect(dbPet).not.toBeNull();
            expect(dbPet.pictures).toEqual([]);

             // Verify recent activity log indicates no picture was added.
            const activity = await RecentActivity.findOne({ petId: response.body._id, type: 'pet_added' });
            expect(activity).not.toBeNull();
            expect(activity.details).not.toContain('with picture');
        });

        // Test case: Verifies that the API returns 400 if required fields are missing.
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

        // Test case: Verifies that the API returns 400 for invalid numeric field values (e.g., negative age).
        it('should return 400 for invalid numeric fields', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', '-1') // Invalid age.
                .field('ageMonths', '6')
                .field('weight', '15')
                .field('species', validPetData.species)
                .field('gender', validPetData.gender)
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Valid age in years/i);
        });

        // Test case: Verifies that the API returns 400 for invalid enum field values (e.g., gender).
         it('should return 400 for invalid enum fields (gender)', async () => {
            const response = await request(app)
                .post('/pets/add')
                .field('name', validPetData.name)
                .field('ageYears', validPetData.ageYears)
                .field('ageMonths', validPetData.ageMonths)
                .field('weight', validPetData.weight)
                .field('species', validPetData.species)
                .field('gender', 'Unknown') // Invalid gender.
                .field('breed', validPetData.breed)
                .field('owner', validPetData.owner);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Gender must be either Male or Female/i);
        });

        // Test case: Verifies that the API returns 404 if the specified owner ID does not exist.
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
                .field('owner', nonExistentOwnerId); // Use a non-existent owner ID.

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Owner not found.');
        });

        // Test case: Verifies that the API returns 400 if an invalid file type is uploaded for the picture.
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
                .attach('picture', Buffer.from('fake text file'), 'document.txt'); // Attach a non-image file.

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Invalid file type/i);
            expect(uploadFileToS3).not.toHaveBeenCalled(); // S3 upload should not have been attempted.
        });

        // Test case: Verifies that the API returns 500 if the S3 upload process fails.
        it('should return 500 if S3 upload fails', async () => {
            // Configure the S3 upload mock to simulate a failure for this test.
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

            // Verify that the pet was NOT created in the database if S3 upload failed.
            const pets = await Pet.find({ name: validPetData.name });
            expect(pets.length).toBe(0);
        });
    });

    // Test suite for the GET /pets/owner/:ownerId endpoint.
    describe('GET /pets/owner/:ownerId', () => {
        let pet1, pet2;
        // Create some pets for the test user before each test in this block.
        beforeEach(async () => {
            pet1 = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
            pet2 = await Pet.create({ name: 'Lucy', ageYears: 1, ageMonths: 5, weight: 4, species: 'Cat', gender: 'Female', breed: 'Siamese', owner: testUserId });
        });

        // Test case: Verifies that all pets belonging to a specific owner are returned.
        it('should return all pets for a valid owner ID', async () => {
            const response = await request(app).get(`/pets/owner/${testUserId}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body[0].name).toBe(pet1.name);
            expect(response.body[1].name).toBe(pet2.name);
            expect(response.body[0]).toHaveProperty('ownerName', testUser.username); // Check if ownerName is added by the route.
        });

        // Test case: Verifies that the API returns 404 if no pets are found for the specified owner.
        it('should return 404 if no pets found for the owner', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString(); // A different, valid ObjectId.
            const response = await request(app).get(`/pets/owner/${otherUserId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('No pets found for this user');
        });
    });

    // Test suite for the GET /pets/ endpoint (get all pets).
    describe('GET /pets/', () => {
        // Test case: Verifies that all pets in the database are returned.
         it('should return all pets in the database', async () => {
            // Create pets for different owners to test retrieval of all pets.
            await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
            const otherUser = await User.create({ email: 'other@test.com', password: 'Password1!', username: 'Other', age: 40 });
            await Pet.create({ name: 'Milo', ageYears: 3, ageMonths: 0, weight: 5, species: 'Cat', gender: 'Male', breed: 'Tabby', owner: otherUser._id });

            const response = await request(app).get('/pets/');

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
        });

        // Test case: Verifies that the API returns 404 if no pets exist in the database.
         it('should return 404 if no pets exist', async () => {
            const response = await request(app).get('/pets/');
            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('No pets found');
        });
    });

    // Test suite for the GET /pets/:id endpoint (get a specific pet).
    describe('GET /pets/:id', () => {
        let testPet;
        // Create a test pet before each test in this block.
        beforeEach(async () => {
            testPet = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
        });

        // Test case: Verifies that a specific pet is returned by its ID.
        it('should return a specific pet by ID', async () => {
            const response = await request(app).get(`/pets/${testPet._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body._id).toBe(testPet._id.toString());
            expect(response.body.name).toBe(testPet.name);
        });

        // Test case: Verifies that the API returns 404 if the pet ID does not exist.
        it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString(); // A valid but non-existent ObjectId.
            const response = await request(app).get(`/pets/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
        });
    });

    // Test suite for the DELETE /pets/:id endpoint.
    describe('DELETE /pets/:id', () => {
        let petToDelete;
        // Create a pet to be deleted before each test in this block.
        beforeEach(async () => {
            petToDelete = await Pet.create({
                name: 'ToDelete', ageYears: 1, ageMonths: 0, weight: 10, species: 'Dog', gender: 'Female', breed: 'Poodle', owner: testUserId,
                pictures: [mockUploadUrl] // Add a picture URL to test S3 deletion logic.
            });
        });

        // Test case: Verifies that a pet and its associated S3 picture are deleted.
        it('should delete a pet and its S3 picture', async () => {
            const response = await request(app).delete(`/pets/${petToDelete._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Pet and associated pictures deleted');

            // Verify that the pet is deleted from the database.
            expect(await Pet.findById(petToDelete._id)).toBeNull();

            // Verify that the S3 deletion function was called with the correct key.
            expect(deleteFileFromS3).toHaveBeenCalledTimes(1);
            // Extract the S3 key from the mock URL for verification.
            const expectedKey = new URL(mockUploadUrl).pathname.substring(1);
            expect(deleteFileFromS3).toHaveBeenCalledWith(expectedKey);

            // Verify that a recent activity log was created for deleting the pet.
            const activity = await RecentActivity.findOne({ petId: petToDelete._id, type: 'pet_deleted' });
            expect(activity).not.toBeNull();
        });

        // Test case: Verifies that a pet without pictures can be deleted successfully.
        it('should delete a pet without pictures', async () => {
             // Create a pet without any pictures.
             const petNoPic = await Pet.create({ name: 'NoPic', ageYears: 1, ageMonths: 0, weight: 10, species: 'Dog', gender: 'Female', breed: 'Poodle', owner: testUserId });
             const response = await request(app).delete(`/pets/${petNoPic._id}`);

             expect(response.statusCode).toBe(200);
             expect(response.body.message).toBe('Pet and associated pictures deleted');
             expect(await Pet.findById(petNoPic._id)).toBeNull();
             expect(deleteFileFromS3).not.toHaveBeenCalled(); // S3 delete should NOT have been called.
        });

        // Test case: Verifies that the API returns 404 if the pet ID for deletion does not exist.
        it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).delete(`/pets/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
            expect(deleteFileFromS3).not.toHaveBeenCalled();
        });

        // Test case: Verifies that database deletion proceeds even if S3 deletion fails.
        it('should proceed with DB deletion even if S3 deletion fails', async () => {
            // Configure the S3 delete mock to simulate a failure.
            deleteFileFromS3.mockRejectedValueOnce(new Error('S3 Delete Failed'));

            const response = await request(app).delete(`/pets/${petToDelete._id}`);

            // The route is designed to catch S3 errors and proceed with DB deletion, so expect 200.
            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Pet and associated pictures deleted');

            // Verify that the pet was still deleted from the database.
            expect(await Pet.findById(petToDelete._id)).toBeNull();

            // Verify that S3 deletion was attempted.
            expect(deleteFileFromS3).toHaveBeenCalledTimes(1);
        });
    });

    // Test suite for the PUT /pets/:id endpoint (update a pet).
    describe('PUT /pets/:id', () => {
         let petToUpdate;
         // Create a pet to be updated before each test in this block.
         beforeEach(async () => {
            petToUpdate = await Pet.create({ name: 'Buddy', ageYears: 2, ageMonths: 1, weight: 12, species: 'Dog', gender: 'Male', breed: 'Lab', owner: testUserId });
         });

        // Test case: Verifies that pet details can be updated successfully.
         it('should update pet details successfully', async () => {
            const updates = {
                name: 'Buddy Updated',
                weight: '13.5', // Sent as string, simulating form data.
                medicalInfo: 'Now on allergy meds'
            };
            const response = await request(app)
                .put(`/pets/${petToUpdate._id}`)
                .send(updates);

            expect(response.statusCode).toBe(200);
            expect(response.body._id).toBe(petToUpdate._id.toString());
            expect(response.body.name).toBe(updates.name);
            expect(response.body.weight).toBe(13.5); // Check if string weight was converted to number.
            expect(response.body.medicalInfo).toBe(updates.medicalInfo);

            // Verify that the updates were saved to the database.
            const dbPet = await Pet.findById(petToUpdate._id);
            expect(dbPet.name).toBe(updates.name);
            expect(dbPet.weight).toBe(13.5);
         });

        // Test case: Verifies that the API returns 404 if the pet ID for update does not exist.
         it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const updates = { name: 'Ghost Pet' };
            const response = await request(app)
                .put(`/pets/${invalidId}`)
                .send(updates);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
         });

        // Test case: Verifies that the API returns 400 for invalid update data (e.g., negative weight).
         it('should return 400 for invalid update data (e.g., negative weight)', async () => {
            const updates = { weight: '-5' };
            const response = await request(app)
               .put(`/pets/${petToUpdate._id}`)
               .send(updates);

            expect(response.statusCode).toBe(400);
            // Check for the specific error message from the route's custom validation.
            expect(response.body.message).toBe('Valid weight (0.1-200) is required for update.');
        });

        // Test case: Verifies that the API returns 400 for invalid enum updates (e.g., species).
        it('should return 400 for invalid enum update (e.g., species)', async () => {
            const updates = { species: 'Fish' }; // Invalid species.
            const response = await request(app)
               .put(`/pets/${petToUpdate._id}`)
               .send(updates);

            expect(response.statusCode).toBe(400);
            // Check for the specific error message from the route's custom validation.
            expect(response.body.message).toBe('Invalid species. Only Dog or Cat allowed.');
        });

        // Test case: Verifies that the 'pictures' field is ignored in the update payload.
         it('should ignore pictures field in update payload', async () => {
             const updates = {
                 name: 'Buddy Updated Again',
                 pictures: ['http://new-hacked-url.com/pic.jpg'] // Attempt to update pictures array.
             };
             const response = await request(app)
                .put(`/pets/${petToUpdate._id}`)
                .send(updates);

             expect(response.statusCode).toBe(200);
             expect(response.body.name).toBe(updates.name);
             expect(response.body.pictures).toEqual([]); // Pictures array should remain unchanged (empty in this setup).

             // Verify that the pictures array in the database is also unchanged.
             const dbPet = await Pet.findById(petToUpdate._id);
             expect(dbPet.pictures).toEqual([]);
         });
    });
});


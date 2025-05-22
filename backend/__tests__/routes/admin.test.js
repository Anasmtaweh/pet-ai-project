// Mock s3Utils BEFORE other imports that might use it (like server.js -> routes/pets.js)
// This ensures that any module importing s3Utils gets the mocked version.
jest.mock('../../utils/s3Utils', () => ({
    uploadToS3: jest.fn().mockResolvedValue({ Location: 'mock-s3-location' }),
    deleteFromS3: jest.fn().mockResolvedValue({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import the Express app
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const Schedule = require('../../models/Schedule');
const RecentActivity = require('../../models/RecentActivity');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../../config/jwtSecret'); // Use the actual secret for signing tokens
const bcrypt = require('bcrypt');

let mongoServer;
let adminUser;
let regularUser;
let adminToken;
let regularUserToken; // Token for a non-admin user, useful for testing authorization

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

// Setup initial test data before each test case.
beforeEach(async () => {
    // Clear all relevant collections to ensure a clean state for each test.
    await User.deleteMany({});
    await Pet.deleteMany({});
    await Schedule.deleteMany({});
    await RecentActivity.deleteMany({});

    // Create an admin user for testing admin-specific routes.
    adminUser = new User({
        email: 'admin@test.com',
        password: 'AdminPassword123!',
        username: 'AdminUser',
        age: 35,
        role: 'admin',
        isActive: true,
    });
    await adminUser.save(); // Password gets hashed by the pre-save hook in the User model.

    // Create a regular user for testing.
    regularUser = new User({
        email: 'user@test.com',
        password: 'UserPassword123!',
        username: 'RegularUser',
        age: 28,
        role: 'user',
        isActive: true,
    });
    await regularUser.save();

    // Create some pet data associated with the regular user.
    await Pet.create([
        { name: 'Buddy', species: 'Dog', gender: 'Male', breed: 'Golden Retriever', ageYears: 3, ageMonths: 0, weight: 30, owner: regularUser._id },
        { name: 'Lucy', species: 'Cat', gender: 'Female', breed: 'Siamese', ageYears: 2, ageMonths: 5, weight: 5, owner: regularUser._id },
    ]);

    // Create some schedule data associated with the regular user.
    await Schedule.create([
        { title: 'Morning Walk', start: new Date(), end: new Date(), type: 'play', owner: regularUser._id },
        { title: 'Vet Checkup', start: new Date(), end: new Date(), type: 'vet', owner: regularUser._id },
    ]);

    // Create some recent activity data for dashboard testing.
    await RecentActivity.create({ type: 'user_signup', details: 'Test signup', userId: regularUser._id });

    // Generate JWT tokens for authentication in tests.
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, jwtSecret.secret, { expiresIn: '1h' });
    regularUserToken = jwt.sign({ id: regularUser._id, role: regularUser.role }, jwtSecret.secret, { expiresIn: '1h' });
});

// Test suite for all admin-related routes under /admin.
describe('Admin Routes', () => {

    // Tests for the authentication and authorization middleware protecting admin routes.
    describe('Authentication Middleware', () => {
        // Test case: Verifies that admin routes return 401 Unauthorized if no token is provided.
        it('should return 401 for routes without token', async () => {
            const userIdParam = regularUser._id.toString();
            const validButNonExistentPetId = new mongoose.Types.ObjectId().toString();

            const testCases = [
                { method: 'GET', path: '/admin/user' },
                { method: 'GET', path: '/admin/dashboard' },
                { method: 'GET', path: '/admin/users' },
                { method: 'PUT', path: `/admin/users/${userIdParam}` },
                { method: 'DELETE', path: `/admin/users/${userIdParam}` },
                { method: 'GET', path: '/admin/pets' },
                { method: 'DELETE', path: `/admin/pets/${validButNonExistentPetId}` },
                { method: 'PUT', path: '/admin/settings/password' },
                { method: 'PUT', path: '/admin/settings/profile' },
            ];

            for (const { method, path } of testCases) {
                let response;
                const req = request(app);

                try {
                    switch (method) {
                        case 'GET':
                            response = await req.get(path);
                            break;
                        case 'PUT':
                            response = await req.put(path).send({}); // Send empty body for PUT
                            break;
                        case 'DELETE':
                            response = await req.delete(path);
                            break;
                        default:
                            throw new Error(`Unsupported method: ${method}`);
                    }

                    if (response.statusCode !== 401) {
                        console.log(`[DEBUG] FAIL (Expected 401): Method=${method}, Path=${path}, Received Status=${response.statusCode}, Body=`, response.body);
                    }
                    expect(response.statusCode).toBe(401, `Expected 401 for ${method} ${path}`);

                } catch (error) {
                     console.error(`[DEBUG] Error during test for ${method} ${path}:`, error);
                     throw error; // Re-throw to fail the test
                }
            }
        });

        // Test case: Verifies that admin routes return 403 Forbidden if a token from a non-admin user is provided.
        it('should return 403 for routes with non-admin token', async () => {
            const userIdParam = regularUser._id.toString();
            const validButNonExistentPetId = new mongoose.Types.ObjectId().toString();

            const testCases = [
                { method: 'GET', path: '/admin/user' },
                { method: 'GET', path: '/admin/dashboard' },
                { method: 'GET', path: '/admin/users' },
                { method: 'PUT', path: `/admin/users/${userIdParam}` },
                { method: 'DELETE', path: `/admin/users/${userIdParam}` },
                { method: 'GET', path: '/admin/pets' },
                { method: 'DELETE', path: `/admin/pets/${validButNonExistentPetId}` },
                { method: 'PUT', path: '/admin/settings/password' },
                { method: 'PUT', path: '/admin/settings/profile' },
            ];

            for (const { method, path } of testCases) {
                let response;
                const req = request(app);

                try {
                    switch (method) {
                        case 'GET':
                            response = await req.get(path).set('Authorization', `Bearer ${regularUserToken}`);
                            break;
                        case 'PUT':
                            response = await req.put(path).send({}).set('Authorization', `Bearer ${regularUserToken}`);
                            break;
                        case 'DELETE':
                            response = await req.delete(path).set('Authorization', `Bearer ${regularUserToken}`);
                            break;
                        default:
                            throw new Error(`Unsupported method: ${method}`);
                    }

                    if (response.statusCode !== 403) {
                        console.log(`[DEBUG] FAIL (Expected 403): Method=${method}, Path=${path}, Received Status=${response.statusCode}, Body=`, response.body);
                    }
                    expect(response.statusCode).toBe(403, `Expected 403 for ${method} ${path}`);

                } catch (error) {
                     console.error(`[DEBUG] Error during test for ${method} ${path}:`, error);
                     throw error; // Re-throw to fail the test
                }
            }
        });
    });

    // Test suite for GET /admin/user endpoint.
    describe('GET /admin/user', () => {
        it('should return admin user details for authenticated admin', async () => {
            const response = await request(app)
                .get('/admin/user')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('_id', adminUser._id.toString());
            expect(response.body).toHaveProperty('email', adminUser.email);
            expect(response.body).toHaveProperty('role', 'admin');
            expect(response.body).not.toHaveProperty('password'); // Ensure password is not sent.
        });
    });

    // Test suite for GET /admin/dashboard endpoint.
    describe('GET /admin/dashboard', () => {
        it('should return dashboard statistics for authenticated admin', async () => {
            const response = await request(app)
                .get('/admin/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('totalUsers', 2); // admin + regular
            expect(response.body).toHaveProperty('totalPets', 2); // Buddy + Lucy
            expect(response.body).toHaveProperty('activeUsers', 2); // Both are active initially
            expect(response.body).toHaveProperty('recentActivity');
            expect(Array.isArray(response.body.recentActivity)).toBe(true);
            expect(response.body.recentActivity.length).toBeGreaterThanOrEqual(1); // At least the signup activity
        });
    });

    // Test suite for GET /admin/users endpoint.
    describe('GET /admin/users', () => {
        it('should return a list of all users for authenticated admin', async () => {
            const response = await request(app)
                .get('/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2); // admin + regular
            expect(response.body[0]).not.toHaveProperty('password');
            expect(response.body[1]).not.toHaveProperty('password');
            // Check if both users are present (order might vary in the response array).
            const emails = response.body.map(u => u.email);
            expect(emails).toContain(adminUser.email);
            expect(emails).toContain(regularUser.email);
        });
    });

    // Test suite for DELETE /admin/users/:id endpoint.
    describe('DELETE /admin/users/:id', () => {
        it('should delete a user and their associated data (pets, schedules)', async () => {
            const userIdToDelete = regularUser._id;

            // Verify data exists before deletion.
            expect(await User.findById(userIdToDelete)).not.toBeNull();
            expect(await Pet.countDocuments({ owner: userIdToDelete })).toBe(2);
            expect(await Schedule.countDocuments({ owner: userIdToDelete })).toBe(2);

            const response = await request(app)
                .delete(`/admin/users/${userIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain('User and associated pets and schedules deleted successfully');

            // Verify data is deleted from the database.
            expect(await User.findById(userIdToDelete)).toBeNull();
            expect(await Pet.countDocuments({ owner: userIdToDelete })).toBe(0);
            expect(await Schedule.countDocuments({ owner: userIdToDelete })).toBe(0);

            // Verify recent activity logs for user and pet deletion.
            const activities = await RecentActivity.find({}).sort({ timestamp: -1 });
            const deletedUserActivities = activities.filter(a => a.type === 'user_deleted' && a.userId.toString() === userIdToDelete.toString());
            const deletedPetActivities = activities.filter(a => a.type === 'pet_deleted' && a.userId.toString() === userIdToDelete.toString());

            expect(deletedUserActivities.length).toBe(1);
            expect(deletedPetActivities.length).toBe(2);
        });

        // NOTE: This test should now PASS because the route handler was fixed to return 404 for non-existent users.
        it('should return 404 if user ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId(); // Generate a valid but non-existent ID
            const response = await request(app)
                .delete(`/admin/users/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toContain('User not found');
        });

         it('should allow deleting the admin user (highlights potential issue if self-deletion is not desired)', async () => {
            // This test demonstrates that an admin *can* delete themselves with the current code.
            // Consider adding logic to prevent self-deletion if this is not the intended behavior.
            const adminIdToDelete = adminUser._id;
            const response = await request(app)
                .delete(`/admin/users/${adminIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200); // Deletion currently succeeds.
            expect(await User.findById(adminIdToDelete)).toBeNull();
        });
    });

    // Test suite for PUT /admin/users/:id endpoint (updating user status).
    describe('PUT /admin/users/:id (Update Status)', () => {
        it('should deactivate an active user', async () => {
            const userIdToUpdate = regularUser._id;
            expect(regularUser.isActive).toBe(true); // Verify initial state.

            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: false }); // Request deactivation.

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain('User status update attempted successfully');
            expect(response.body.userId).toBe(userIdToUpdate.toString());
            expect(response.body.requestedStatus).toBe(false);
            expect(response.body.initialStatus).toBe(true);
            expect(response.body.finalStatus).toBe(false); // Check status after save.
            expect(response.body.saveError).toBeNull();

            // Verify in DB.
            const updatedUser = await User.findById(userIdToUpdate);
            expect(updatedUser.isActive).toBe(false);
        });

        it('should activate an inactive user', async () => {
            // First, make the user inactive.
            await User.findByIdAndUpdate(regularUser._id, { isActive: false });
            const userBeforeUpdate = await User.findById(regularUser._id);
            expect(userBeforeUpdate.isActive).toBe(false); // Verify initial state.

            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: true }); // Request activation.

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain('User status update attempted successfully');
            expect(response.body.requestedStatus).toBe(true);
            expect(response.body.initialStatus).toBe(false);
            expect(response.body.finalStatus).toBe(true); // Check status after save.
            expect(response.body.saveError).toBeNull();

            // Verify in DB.
            const updatedUser = await User.findById(userIdToUpdate);
            expect(updatedUser.isActive).toBe(true);
        });

        it('should return 404 if user ID does not exist for status update', async () => {
            const invalidId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/admin/users/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: false });

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toContain('User not found');
        });

        it('should return 400 if isActive is not a boolean in request body', async () => {
            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: 'not-a-boolean' }); // Invalid data type.

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Invalid value provided for isActive status/i);
        });

         it('should return 400 if isActive is missing in request body', async () => {
            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({}); // Missing isActive.

            expect(response.statusCode).toBe(400);
             expect(response.body.message).toMatch(/Invalid value provided for isActive status/i);
        });
    });

    // Test suite for GET /admin/pets endpoint.
    describe('GET /admin/pets', () => {
        it('should return all pets with owner email and username populated', async () => {
            const response = await request(app)
                .get('/admin/pets')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2); // Buddy and Lucy.

            // Check structure of one pet to ensure owner details are populated.
            const pet = response.body.find(p => p.name === 'Buddy');
            expect(pet).toBeDefined();
            expect(pet).toHaveProperty('name', 'Buddy');
            expect(pet).toHaveProperty('species', 'Dog');
            expect(pet).toHaveProperty('owner'); // Should have owner object from populate.
            expect(pet.owner).toHaveProperty('email', regularUser.email);
            expect(pet).toHaveProperty('ownerName', regularUser.email); // Check the added field (currently email).
        });
    });

    // Test suite for DELETE /admin/pets/:id endpoint.
    describe('DELETE /admin/pets/:id', () => {
        it('should delete a specific pet and log activity', async () => {
            const petToDelete = await Pet.findOne({ name: 'Buddy' });
            expect(petToDelete).not.toBeNull();
            const petIdToDelete = petToDelete._id;

            const response = await request(app)
                .delete(`/admin/pets/${petIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            // --- FIX 1: Update expected message --- (Comment kept for context)
            expect(response.body.message).toBe('Pet deleted successfully');

            // Verify deletion in DB.
            expect(await Pet.findById(petIdToDelete)).toBeNull();
            expect(await Pet.countDocuments()).toBe(1); // Only Lucy should remain.

            // Verify recent activity log for pet deletion.
            const activity = await RecentActivity.findOne({ type: 'pet_deleted', petId: petIdToDelete });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain('Pet deleted: Buddy');
            expect(activity.userId?.toString()).toBe(regularUser._id.toString()); // Ensure owner's ID is logged.
        });

        it('should return 404 if pet ID does not exist for deletion', async () => {
            const invalidId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/admin/pets/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
        });
    });

    // Test suite for PUT /admin/settings/password endpoint.
    describe('PUT /admin/settings/password', () => {
        const currentPassword = 'AdminPassword123!';
        const newPassword = 'NewAdminPassword456!';

        it('should update the admin password with correct current password', async () => {
            const response = await request(app)
                .put('/admin/settings/password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ currentPassword, newPassword });

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Password updated successfully');

            // Verify password change by checking the hash in the database.
            const updatedAdmin = await User.findById(adminUser._id);
            expect(updatedAdmin).not.toBeNull();
            const isMatchWithOld = await bcrypt.compare(currentPassword, updatedAdmin.password);
            const isMatchWithNew = await bcrypt.compare(newPassword, updatedAdmin.password);
            expect(isMatchWithOld).toBe(false);
            expect(isMatchWithNew).toBe(true);
        });

        it('should return 400 if current password is incorrect', async () => {
            const response = await request(app)
                .put('/admin/settings/password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ currentPassword: 'WrongPassword!', newPassword });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Incorrect current password');
        });

        // --- FIX 2: Update expected status and message check --- (Comment kept for context)
        // Test case: Verifies that new password must meet validation criteria (e.g., length, complexity).
        it('should return 400 if new password fails validation (e.g., too short)', async () => {
             const response = await request(app)
                .put('/admin/settings/password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ currentPassword, newPassword: 'short' }); // Invalid password.

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Password must be at least 8 characters long|Password validation failed/i);
        });
    });

    // Test suite for PUT /admin/settings/profile endpoint.
    describe('PUT /admin/settings/profile', () => {
        it('should update the admin profile (username and age)', async () => {
            const newProfileData = { username: 'UpdatedAdmin', age: 40 };

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newProfileData);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Profile updated successfully');

            // Verify update in DB.
            const updatedAdmin = await User.findById(adminUser._id);
            expect(updatedAdmin.username).toBe(newProfileData.username);
            expect(updatedAdmin.age).toBe(newProfileData.age);
        });

        // --- FIX 3: Update regex pattern --- (Comment kept for context)
        // Test case: Verifies that age must meet validation criteria.
        it('should return 400 if age is invalid (e.g., less than 13)', async () => {
            const invalidProfileData = { username: 'AdminWithInvalidAge', age: 10 }; // Age < 13.

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(invalidProfileData);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/Age must be a number between 13 and 120|Validation failed/i);
        });

         it('should partially update profile if only one valid field is provided (e.g., only username)', async () => {
            const partialProfileData = { username: 'OnlyUsernameUpdated' }; // No age provided.

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(partialProfileData);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Profile updated successfully');

            // Verify update in DB: username changed, age remains the same.
            const updatedAdmin = await User.findById(adminUser._id);
            expect(updatedAdmin.username).toBe(partialProfileData.username);
            expect(updatedAdmin.age).toBe(adminUser.age); // Age should remain unchanged.
        });
    });
});


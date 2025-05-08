// c:\Users\Anas\Desktop\backend\__tests__\routes\admin.test.js

// --- Add Mocking ---
// Mock s3Utils BEFORE other imports that might use it (like server.js -> routes/pets.js)
jest.mock('../../utils/s3Utils', () => ({
    uploadToS3: jest.fn().mockResolvedValue({ Location: 'mock-s3-location' }),
    deleteFromS3: jest.fn().mockResolvedValue({}),
    
}));
// --- End Mocking ---

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import app from server.js
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const Schedule = require('../../models/Schedule');
const RecentActivity = require('../../models/RecentActivity');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../../config/jwtSecret'); // Use the actual secret for signing
const bcrypt = require('bcrypt');

let mongoServer;
let adminUser;
let regularUser;
let adminToken;
let regularUserToken; // Might be useful for testing unauthorized access

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
    // Clear all relevant collections
    await User.deleteMany({});
    await Pet.deleteMany({});
    await Schedule.deleteMany({});
    await RecentActivity.deleteMany({});

    // Create an admin user
    adminUser = new User({
        email: 'admin@test.com',
        password: 'AdminPassword123!', // Use a valid password
        username: 'AdminUser',
        age: 35,
        role: 'admin',
        isActive: true,
    });
    await adminUser.save(); // Password gets hashed by pre-save hook

    // Create a regular user
    regularUser = new User({
        email: 'user@test.com',
        password: 'UserPassword123!',
        username: 'RegularUser',
        age: 28,
        role: 'user',
        isActive: true,
    });
    await regularUser.save();

    // Create some pets for the regular user
    await Pet.create([
        { name: 'Buddy', species: 'Dog', gender: 'Male', breed: 'Golden Retriever', ageYears: 3, ageMonths: 0, weight: 30, owner: regularUser._id },
        { name: 'Lucy', species: 'Cat', gender: 'Female', breed: 'Siamese', ageYears: 2, ageMonths: 5, weight: 5, owner: regularUser._id },
    ]);

    // Create some schedules for the regular user
    await Schedule.create([
        { title: 'Morning Walk', start: new Date(), end: new Date(), type: 'play', owner: regularUser._id },
        { title: 'Vet Checkup', start: new Date(), end: new Date(), type: 'vet', owner: regularUser._id },
    ]);

    // Create some recent activity (optional, for dashboard test)
    await RecentActivity.create({ type: 'user_signup', details: 'Test signup', userId: regularUser._id });

    // Generate JWT tokens
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, jwtSecret.secret, { expiresIn: '1h' });
    regularUserToken = jwt.sign({ id: regularUser._id, role: regularUser.role }, jwtSecret.secret, { expiresIn: '1h' });
});
// --- End Test Data Setup ---


// --- Admin Route Tests ---
describe('Admin Routes', () => {

    // --- Middleware Tests ---
    describe('Authentication Middleware', () => {
        // --- Corrected Test for 401 ---
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

                    // Add logging for unexpected status codes
                    if (response.statusCode !== 401) {
                        console.log(`[DEBUG] FAIL (Expected 401): Method=${method}, Path=${path}, Received Status=${response.statusCode}, Body=`, response.body);
                    }
                    // Correct Jest custom message format: second argument to matcher
                    expect(response.statusCode).toBe(401, `Expected 401 for ${method} ${path}`);

                } catch (error) {
                     console.error(`[DEBUG] Error during test for ${method} ${path}:`, error);
                     throw error; // Re-throw to fail the test
                }
            }
        });

        // --- Corrected Test for 403 ---
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

                     // Add logging for unexpected status codes
                    if (response.statusCode !== 403) {
                        console.log(`[DEBUG] FAIL (Expected 403): Method=${method}, Path=${path}, Received Status=${response.statusCode}, Body=`, response.body);
                    }
                     // Correct Jest custom message format: second argument to matcher
                    expect(response.statusCode).toBe(403, `Expected 403 for ${method} ${path}`);

                } catch (error) {
                     console.error(`[DEBUG] Error during test for ${method} ${path}:`, error);
                     throw error; // Re-throw to fail the test
                }
            }
        });
    });

    // --- GET /admin/user ---
    describe('GET /admin/user', () => {
        it('should return admin user details for authenticated admin', async () => {
            const response = await request(app)
                .get('/admin/user')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('_id', adminUser._id.toString());
            expect(response.body).toHaveProperty('email', adminUser.email);
            expect(response.body).toHaveProperty('role', 'admin');
            expect(response.body).not.toHaveProperty('password');
        });
    });

    // --- GET /admin/dashboard ---
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

    // --- GET /admin/users ---
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
            // Check if both users are present (order might vary)
            const emails = response.body.map(u => u.email);
            expect(emails).toContain(adminUser.email);
            expect(emails).toContain(regularUser.email);
        });
    });

    // --- DELETE /admin/users/:id ---
    describe('DELETE /admin/users/:id', () => {
        it('should delete a user and their associated data', async () => {
            const userIdToDelete = regularUser._id;

            // Verify data exists before deletion
            expect(await User.findById(userIdToDelete)).not.toBeNull();
            expect(await Pet.countDocuments({ owner: userIdToDelete })).toBe(2);
            expect(await Schedule.countDocuments({ owner: userIdToDelete })).toBe(2);

            const response = await request(app)
                .delete(`/admin/users/${userIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            // This expectation depends on the route handler being fixed
            expect(response.statusCode).toBe(200);
            // Adjust message if changed in route handler
            expect(response.body.message).toContain('User and associated pets and schedules deleted successfully'); // Match exact message

            // Verify data is deleted
            expect(await User.findById(userIdToDelete)).toBeNull();
            expect(await Pet.countDocuments({ owner: userIdToDelete })).toBe(0);
            expect(await Schedule.countDocuments({ owner: userIdToDelete })).toBe(0);

            // Verify recent activity logs
            const activities = await RecentActivity.find({}).sort({ timestamp: -1 });
            // Note: Order might vary slightly depending on async operations
            const deletedUserActivities = activities.filter(a => a.type === 'user_deleted' && a.userId.toString() === userIdToDelete.toString());
            const deletedPetActivities = activities.filter(a => a.type === 'pet_deleted' && a.userId.toString() === userIdToDelete.toString());

            expect(deletedUserActivities.length).toBe(1);
            expect(deletedPetActivities.length).toBe(2);
        });

        // --- Test for Invalid User ID ---
        // NOTE: This test should now PASS because the route handler was fixed
        it('should return 404 if user ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId(); // Generate a valid but non-existent ID
            const response = await request(app)
                .delete(`/admin/users/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(404); // Expect 404
            expect(response.body.message).toContain('User not found');
        });
        // --- End Test ---

         it('should allow deleting the admin user (potential issue)', async () => {
            // This test highlights that an admin *can* delete themselves with the current code
            const adminIdToDelete = adminUser._id;
            const response = await request(app)
                .delete(`/admin/users/${adminIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200); // It succeeds currently
            expect(await User.findById(adminIdToDelete)).toBeNull();
            // Consider adding logic to prevent self-deletion if desired
        });
    });

    // --- PUT /admin/users/:id ---
    describe('PUT /admin/users/:id (Update Status)', () => {
        it('should deactivate an active user', async () => {
            const userIdToUpdate = regularUser._id;
            expect(regularUser.isActive).toBe(true); // Verify initial state

            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: false }); // Request deactivation

            expect(response.statusCode).toBe(200);
            // Check the detailed response from the route
            expect(response.body.message).toContain('User status update attempted successfully'); // Match exact message
            expect(response.body.userId).toBe(userIdToUpdate.toString());
            expect(response.body.requestedStatus).toBe(false);
            expect(response.body.initialStatus).toBe(true);
            expect(response.body.finalStatus).toBe(false); // Check status after save
            expect(response.body.saveError).toBeNull();


            // Verify in DB
            const updatedUser = await User.findById(userIdToUpdate);
            expect(updatedUser.isActive).toBe(false);
        });

        it('should activate an inactive user', async () => {
            // First, make the user inactive
            await User.findByIdAndUpdate(regularUser._id, { isActive: false });
            const userBeforeUpdate = await User.findById(regularUser._id);
            expect(userBeforeUpdate.isActive).toBe(false); // Verify initial state

            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: true }); // Request activation

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain('User status update attempted successfully'); // Match exact message
            expect(response.body.requestedStatus).toBe(true);
            expect(response.body.initialStatus).toBe(false);
            expect(response.body.finalStatus).toBe(true); // Check status after save
            expect(response.body.saveError).toBeNull();

            // Verify in DB
            const updatedUser = await User.findById(userIdToUpdate);
            expect(updatedUser.isActive).toBe(true);
        });

        it('should return 404 if user ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/admin/users/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: false });

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toContain('User not found');
        });

        it('should return 400 if isActive is not a boolean', async () => {
            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isActive: 'not-a-boolean' }); // Invalid data type

            expect(response.statusCode).toBe(400);
            // Check the specific error message from your route handler
            expect(response.body.message).toMatch(/Invalid value provided for isActive status/i);
        });

         it('should return 400 if isActive is missing', async () => {
            const userIdToUpdate = regularUser._id;
            const response = await request(app)
                .put(`/admin/users/${userIdToUpdate}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({}); // Missing isActive

            expect(response.statusCode).toBe(400);
             // Check the specific error message from your route handler
             expect(response.body.message).toMatch(/Invalid value provided for isActive status/i);
        });
    });

    // --- GET /admin/pets ---
    describe('GET /admin/pets', () => {
        it('should return all pets with owner email', async () => {
            const response = await request(app)
                .get('/admin/pets')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2); // Buddy and Lucy

            // Check structure of one pet
            const pet = response.body.find(p => p.name === 'Buddy');
            expect(pet).toBeDefined();
            expect(pet).toHaveProperty('name', 'Buddy');
            expect(pet).toHaveProperty('species', 'Dog');
            expect(pet).toHaveProperty('owner'); // Should have owner object from populate
            expect(pet.owner).toHaveProperty('email', regularUser.email);
            expect(pet).toHaveProperty('ownerName', regularUser.email); // Check the added field
        });
    });

    // --- DELETE /admin/pets/:id ---
    describe('DELETE /admin/pets/:id', () => {
        it('should delete a specific pet', async () => {
            const petToDelete = await Pet.findOne({ name: 'Buddy' });
            expect(petToDelete).not.toBeNull();
            const petIdToDelete = petToDelete._id;

            const response = await request(app)
                .delete(`/admin/pets/${petIdToDelete}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            // --- FIX 1: Update expected message ---
            expect(response.body.message).toBe('Pet deleted successfully');

            // Verify deletion in DB
            expect(await Pet.findById(petIdToDelete)).toBeNull();
            expect(await Pet.countDocuments()).toBe(1); // Only Lucy should remain

            // Verify recent activity
            const activity = await RecentActivity.findOne({ type: 'pet_deleted', petId: petIdToDelete });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain('Pet deleted: Buddy');
            // Ensure userId is populated correctly in logActivity
            expect(activity.userId?.toString()).toBe(regularUser._id.toString());
        });

        it('should return 404 if pet ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/admin/pets/${invalidId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Pet not found');
        });
    });

    // --- PUT /admin/settings/password ---
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

            // Verify password change by checking the hash
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

        // --- FIX 2: Update expected status and message check ---
        it('should return 400 if new password fails validation (e.g., too short)', async () => {
             const response = await request(app)
                .put('/admin/settings/password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ currentPassword, newPassword: 'short' }); // Invalid password

            // The route handler catches validation errors and returns 400
            expect(response.statusCode).toBe(400);
            // Check that the message contains the validation error text
            expect(response.body.message).toMatch(/Password must be at least 8 characters long|Password validation failed/i);
        });
        // --- End FIX 2 ---
    });

    // --- PUT /admin/settings/profile ---
    describe('PUT /admin/settings/profile', () => {
        it('should update the admin profile (username and age)', async () => {
            const newProfileData = { username: 'UpdatedAdmin', age: 40 };

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newProfileData);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Profile updated successfully');

            // Verify update in DB
            const updatedAdmin = await User.findById(adminUser._id);
            expect(updatedAdmin.username).toBe(newProfileData.username);
            expect(updatedAdmin.age).toBe(newProfileData.age);
        });

        // --- FIX 3: Update regex pattern ---
        it('should return 400 if age is invalid', async () => {
            const invalidProfileData = { username: 'AdminWithInvalidAge', age: 10 }; // Age < 13

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(invalidProfileData);

            expect(response.statusCode).toBe(400);
            // Check the specific error message from the route handler's check
            expect(response.body.message).toMatch(/Age must be a number between 13 and 120|Validation failed/i);
        });
        // --- End FIX 3 ---

         it('should partially update if only one valid field is provided', async () => {
            const partialProfileData = { username: 'OnlyUsernameUpdated' }; // No age

            const response = await request(app)
                .put('/admin/settings/profile')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(partialProfileData);

            expect(response.statusCode).toBe(200); // Update should succeed
            expect(response.body.message).toBe('Profile updated successfully');

            // Verify update in DB
            const updatedAdmin = await User.findById(adminUser._id);
            expect(updatedAdmin.username).toBe(partialProfileData.username);
            expect(updatedAdmin.age).toBe(adminUser.age); // Age should remain unchanged
        });
    });

});

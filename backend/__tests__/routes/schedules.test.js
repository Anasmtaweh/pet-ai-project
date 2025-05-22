// Test suite for the /schedules routes, covering schedule creation, retrieval, update, deletion, and exception handling.

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server'); // Import app from server.js
const User = require('../../models/User');
const Schedule = require('../../models/Schedule');
const RecentActivity = require('../../models/RecentActivity');

let mongoServer;
let testUser;
let testUserId;

// Setup for the test environment: runs once before all tests in this file.
// Initializes an in-memory MongoDB server for isolated testing.
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
});

// Teardown for the test environment: runs once after all tests in this file.
// Disconnects Mongoose and stops the in-memory MongoDB server.
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Setup initial test data before each test case.
// Clears relevant collections and creates a test user for ownership.
beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Schedule.deleteMany({});
    await RecentActivity.deleteMany({});

    // Create a test user for ownership
    testUser = new User({
        email: 'scheduleowner@test.com',
        password: 'OwnerPassword123!',
        username: 'ScheduleOwner',
        age: 30,
    });
    await testUser.save();
    testUserId = testUser._id.toString();
});


// Test suite for all schedule-related routes under /schedules.
describe('Schedule Routes', () => {

    // Test suite for the POST /schedules/add endpoint.
    describe('POST /schedules/add', () => {
        const validScheduleData = {
            title: 'Morning Feed',
            start: new Date('2024-09-01T08:00:00Z').toISOString(), // Use ISO strings for requests
            end: new Date('2024-09-01T08:30:00Z').toISOString(),
            type: 'meal',
            repeat: false,
            owner: '', // Will be set in test
        };

        // Set the owner ID for validScheduleData before each test in this describe block.
        beforeEach(() => {
            validScheduleData.owner = testUserId;
        });

        // Test case: Verifies successful schedule creation.
        it('should add a new schedule successfully', async () => {
            const response = await request(app)
                .post('/schedules/add')
                .send(validScheduleData);

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body.title).toBe(validScheduleData.title);
            expect(response.body.type).toBe(validScheduleData.type);
            expect(response.body.owner).toBe(testUserId);
            expect(new Date(response.body.start)).toEqual(new Date(validScheduleData.start));

            // Verify DB
            const dbSchedule = await Schedule.findById(response.body._id);
            expect(dbSchedule).not.toBeNull();
            expect(dbSchedule.title).toBe(validScheduleData.title);

            // Verify Recent Activity
            const activity = await RecentActivity.findOne({ scheduleId: response.body._id, type: 'schedule_added' });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain(validScheduleData.title);
            expect(activity.userId.toString()).toBe(testUserId);
        });

        // Test case: Verifies successful creation of a repeating schedule.
        it('should add a repeating schedule successfully', async () => {
            const repeatingData = {
                ...validScheduleData,
                repeat: true,
                repeatType: 'weekly',
                repeatDays: ['Monday', 'Friday']
            };
            const response = await request(app)
                .post('/schedules/add')
                .send(repeatingData);

            expect(response.statusCode).toBe(201);
            expect(response.body.repeat).toBe(true);
            expect(response.body.repeatType).toBe('weekly');
            expect(response.body.repeatDays).toEqual(['Monday', 'Friday']);

            const dbSchedule = await Schedule.findById(response.body._id);
            expect(dbSchedule.repeatDays).toEqual(['Monday', 'Friday']);
        });

        // Test case: Verifies that the API returns 400 if required fields are missing.
        it('should return 400 if required fields are missing', async () => {
            const invalidData = { ...validScheduleData };
            delete invalidData.title; // Remove title

            const response = await request(app)
                .post('/schedules/add')
                .send(invalidData);

            // Expect 400 because the manual validation check in the route catches it
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Missing required fields (title, start, end, type, owner)');
        });

        // Test case: Verifies that the API returns 400 for invalid enum values (e.g., type).
         it('should return 400 for invalid enum type', async () => {
            const invalidData = { ...validScheduleData, type: 'invalid-type' };
            const response = await request(app)
                .post('/schedules/add')
                .send(invalidData);

            // Expect 400 because the route handler catches Mongoose ValidationError
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Validation error');
            expect(response.body.details).toHaveProperty('type'); // Check that 'type' field caused the validation error
        });
    });

    // Test suite for the GET /schedules/owner/:ownerId endpoint.
    describe('GET /schedules/owner/:ownerId', () => {
        let schedule1, schedule2;
        // Create some schedules for the test user before each test in this block.
        beforeEach(async () => {
            schedule1 = await Schedule.create({ title: 'Walk', start: new Date(), end: new Date(), type: 'play', owner: testUserId });
            schedule2 = await Schedule.create({ title: 'Dinner', start: new Date(), end: new Date(), type: 'meal', owner: testUserId });
        });

        // Test case: Verifies that all schedules belonging to a specific owner are returned.
        it('should return all schedules for a valid owner ID', async () => {
            const response = await request(app).get(`/schedules/owner/${testUserId}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            // Check if IDs match (order might vary in the response array)
            const receivedIds = response.body.map(s => s._id);
            expect(receivedIds).toContain(schedule1._id.toString());
            expect(receivedIds).toContain(schedule2._id.toString());
        });

        // Test case: Verifies that an empty array is returned if the owner has no schedules.
        it('should return an empty array if owner has no schedules', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString(); // A different, valid ObjectId.
            const response = await request(app).get(`/schedules/owner/${otherUserId}`);

            expect(response.statusCode).toBe(200); // Route returns 200 with an empty array for no schedules found.
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });
    });

    // Test suite for the PUT /schedules/:id endpoint (update a schedule).
    describe('PUT /schedules/:id', () => {
        let scheduleToUpdate;
        // Create a schedule to be updated before each test in this block.
        beforeEach(async () => {
            scheduleToUpdate = await Schedule.create({ title: 'Initial Title', start: new Date(), end: new Date(), type: 'play', owner: testUserId });
        });

        // Test case: Verifies that schedule details can be updated successfully.
        it('should update a schedule successfully', async () => {
            const updates = {
                title: 'Updated Title',
                type: 'sleep',
                repeat: true,
                repeatType: 'daily'
            };
            const response = await request(app)
                .put(`/schedules/${scheduleToUpdate._id}`)
                .send(updates);

            expect(response.statusCode).toBe(200);
            expect(response.body._id).toBe(scheduleToUpdate._id.toString());
            expect(response.body.title).toBe(updates.title);
            expect(response.body.type).toBe(updates.type);
            expect(response.body.repeat).toBe(true);

            // Verify DB
            const dbSchedule = await Schedule.findById(scheduleToUpdate._id);
            expect(dbSchedule.title).toBe(updates.title);
            expect(dbSchedule.type).toBe(updates.type);
        });

        // Test case: Verifies that the API returns 404 if the schedule ID for update does not exist.
        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const updates = { title: 'Ghost Schedule' };
            const response = await request(app)
                .put(`/schedules/${invalidId}`)
                .send(updates);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule not found');
        });

        // Test case: Verifies that the API returns 400 for invalid update data (e.g., invalid enum type).
        it('should return 400 for invalid update data (e.g., invalid type)', async () => {
            const updates = { type: 'invalid-enum' };
            const response = await request(app)
                .put(`/schedules/${scheduleToUpdate._id}`)
                .send(updates);

            // Expect 400 because runValidators=true in findByIdAndUpdate triggers Mongoose ValidationError
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Validation error');
            expect(response.body.details).toHaveProperty('type'); // Check that 'type' field caused the validation error
        });
    });

    // Test suite for the DELETE /schedules/:id endpoint.
    describe('DELETE /schedules/:id', () => {
        let scheduleToDelete;
        // Create a schedule to be deleted before each test in this block.
        beforeEach(async () => {
            scheduleToDelete = await Schedule.create({ title: 'To Delete', start: new Date(), end: new Date(), type: 'vet', owner: testUserId });
        });

        // Test case: Verifies that a schedule can be deleted successfully.
        it('should delete a schedule successfully', async () => {
            const response = await request(app)
                .delete(`/schedules/${scheduleToDelete._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Schedule deleted');

            // Verify DB deletion
            expect(await Schedule.findById(scheduleToDelete._id)).toBeNull();

            // Verify Recent Activity
            const activity = await RecentActivity.findOne({ scheduleId: scheduleToDelete._id, type: 'schedule_deleted' });
            expect(activity).not.toBeNull();
            expect(activity.details).toContain(scheduleToDelete.title);
            expect(activity.userId.toString()).toBe(testUserId);
        });

        // Test case: Verifies that the API returns 404 if the schedule ID for deletion does not exist.
        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .delete(`/schedules/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule not found');
        });
    });

    // Test suite for the POST /schedules/:id/exception endpoint (marking an occurrence as an exception).
    describe('POST /schedules/:id/exception', () => {
        let scheduleRule;
        const occurrenceDate = new Date('2024-10-10T10:00:00Z');

        // Create a repeating schedule rule before each test in this block.
        beforeEach(async () => {
            scheduleRule = await Schedule.create({
                title: 'Daily Meds',
                start: new Date('2024-10-01T10:00:00Z'),
                end: new Date('2024-10-31T10:00:00Z'), // End date for the repeating rule
                type: 'medication',
                owner: testUserId,
                repeat: true,
                repeatType: 'daily'
            });
        });

        // Test case: Verifies that an exception date can be added successfully to a schedule.
        it('should add an exception date successfully', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Occurrence marked as exception.');
            expect(response.body.schedule).toBeDefined();
            expect(response.body.schedule.exceptionDates).toHaveLength(1);
            // Compare dates carefully, ensuring they are treated as Date objects for comparison.
            expect(new Date(response.body.schedule.exceptionDates[0])).toEqual(occurrenceDate);

            // Verify DB
            const dbSchedule = await Schedule.findById(scheduleRule._id);
            expect(dbSchedule.exceptionDates).toHaveLength(1);
            expect(dbSchedule.exceptionDates[0]).toEqual(occurrenceDate);
        });

        // Test case: Verifies that duplicate exception dates are not added.
        it('should prevent adding duplicate exception dates', async () => {
            // Add the exception first
            await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            // Try adding the same exception again
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(200); // Still 200 because $addToSet doesn't error on duplicates, it just doesn't add.
            expect(response.body.schedule.exceptionDates).toHaveLength(1); // Should still only have one exception date.

            // Verify DB
            const dbSchedule = await Schedule.findById(scheduleRule._id);
            expect(dbSchedule.exceptionDates).toHaveLength(1); // Confirm only one instance in the database.
        });

        // Test case: Verifies that the API returns 404 if the schedule ID does not exist.
        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .post(`/schedules/${invalidId}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule rule not found');
        });

        // Test case: Verifies that the API returns 400 if the occurrenceDate is missing in the request.
        it('should return 400 if occurrenceDate is missing', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({}); // Missing occurrenceDate in payload.

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Occurrence date is required.');
        });

        // Test case: Verifies that the API returns 400 if the provided occurrenceDate is invalid.
        it('should return 400 if occurrenceDate is invalid', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: 'not-a-valid-date' });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Invalid occurrence date format provided.');
        });
    });
});

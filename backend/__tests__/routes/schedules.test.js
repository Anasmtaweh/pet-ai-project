// c:\Users\Anas\Desktop\backend\__tests__\routes\schedules.test.js

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
// --- End Test Data Setup ---


// --- Schedule Route Tests ---
describe('Schedule Routes', () => {

    // --- POST /schedules/add ---
    describe('POST /schedules/add', () => {
        const validScheduleData = {
            title: 'Morning Feed',
            start: new Date('2024-09-01T08:00:00Z').toISOString(), // Use ISO strings for requests
            end: new Date('2024-09-01T08:30:00Z').toISOString(),
            type: 'meal',
            repeat: false,
            owner: '', // Will be set in test
        };

        beforeEach(() => {
            validScheduleData.owner = testUserId;
        });

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


        it('should return 400 if required fields are missing', async () => { // Updated test name
            const invalidData = { ...validScheduleData };
            delete invalidData.title; // Remove title

            const response = await request(app)
                .post('/schedules/add')
                .send(invalidData);

            // Expect 400 because the manual validation check catches it
            expect(response.statusCode).toBe(400);

            expect(response.body.message).toBe('Missing required fields (title, start, end, type, owner)');

        });


        
         it('should return 400 for invalid enum type', async () => { // Updated test name
            const invalidData = { ...validScheduleData, type: 'invalid-type' };
            const response = await request(app)
                .post('/schedules/add')
                .send(invalidData);

            // Expect 400 because the route handler catches ValidationError
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Validation error');
            expect(response.body.details).toHaveProperty('type'); // Check type caused the error
        });
        
    });

    // --- GET /schedules/owner/:ownerId ---
    describe('GET /schedules/owner/:ownerId', () => {
        let schedule1, schedule2;
        beforeEach(async () => {
            // Create schedules for the test user
            schedule1 = await Schedule.create({ title: 'Walk', start: new Date(), end: new Date(), type: 'play', owner: testUserId });
            schedule2 = await Schedule.create({ title: 'Dinner', start: new Date(), end: new Date(), type: 'meal', owner: testUserId });
        });

        it('should return all schedules for a valid owner ID', async () => {
            const response = await request(app).get(`/schedules/owner/${testUserId}`);

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            // Check if IDs match (order might vary)
            const receivedIds = response.body.map(s => s._id);
            expect(receivedIds).toContain(schedule1._id.toString());
            expect(receivedIds).toContain(schedule2._id.toString());
        });

        it('should return an empty array if owner has no schedules', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).get(`/schedules/owner/${otherUserId}`);

            expect(response.statusCode).toBe(200); // Route returns 200 with empty array
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        // Route doesn't validate ownerId format currently
        // it('should return 400 for invalid owner ID format', async () => { ... });
    });

    // --- PUT /schedules/:id ---
    describe('PUT /schedules/:id', () => {
        let scheduleToUpdate;
        beforeEach(async () => {
            scheduleToUpdate = await Schedule.create({ title: 'Initial Title', start: new Date(), end: new Date(), type: 'play', owner: testUserId });
        });

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

        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const updates = { title: 'Ghost Schedule' };
            const response = await request(app)
                .put(`/schedules/${invalidId}`)
                .send(updates);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule not found');
        });

        
        it('should return 400 for invalid update data (e.g., invalid type)', async () => { // Updated test name
            const updates = { type: 'invalid-enum' };
            const response = await request(app)
                .put(`/schedules/${scheduleToUpdate._id}`)
                .send(updates);

            // Expect 400 because runValidators=true triggers ValidationError catch block
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Validation error');
            expect(response.body.details).toHaveProperty('type'); // Check type caused the error
        });
        

        // Route doesn't validate ID format
        // it('should return 500 for invalid schedule ID format', async () => { ... });
    });

    // --- DELETE /schedules/:id ---
    describe('DELETE /schedules/:id', () => {
        let scheduleToDelete;
        beforeEach(async () => {
            scheduleToDelete = await Schedule.create({ title: 'To Delete', start: new Date(), end: new Date(), type: 'vet', owner: testUserId });
        });

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

        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .delete(`/schedules/${invalidId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule not found');
        });

        // Route doesn't validate ID format
        // it('should return 500 for invalid schedule ID format', async () => { ... });
    });

    // --- POST /schedules/:id/exception ---
    describe('POST /schedules/:id/exception', () => {
        let scheduleRule;
        const occurrenceDate = new Date('2024-10-10T10:00:00Z');

        beforeEach(async () => {
            scheduleRule = await Schedule.create({
                title: 'Daily Meds',
                start: new Date('2024-10-01T10:00:00Z'),
                end: new Date('2024-10-31T10:00:00Z'), // Rule end date
                type: 'medication',
                owner: testUserId,
                repeat: true,
                repeatType: 'daily'
            });
        });

        it('should add an exception date successfully', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Occurrence marked as exception.');
            expect(response.body.schedule).toBeDefined();
            expect(response.body.schedule.exceptionDates).toHaveLength(1);
            // Compare dates carefully
            expect(new Date(response.body.schedule.exceptionDates[0])).toEqual(occurrenceDate);

            // Verify DB
            const dbSchedule = await Schedule.findById(scheduleRule._id);
            expect(dbSchedule.exceptionDates).toHaveLength(1);
            expect(dbSchedule.exceptionDates[0]).toEqual(occurrenceDate);
        });

        it('should prevent adding duplicate exception dates', async () => {
            // Add the exception first
            await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            // Try adding the same exception again
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(200); // Still 200 because $addToSet doesn't error on duplicates
            expect(response.body.schedule.exceptionDates).toHaveLength(1); // Should still only have one

            // Verify DB
            const dbSchedule = await Schedule.findById(scheduleRule._id);
            expect(dbSchedule.exceptionDates).toHaveLength(1);
        });

        it('should return 404 if schedule ID does not exist', async () => {
            const invalidId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .post(`/schedules/${invalidId}/exception`)
                .send({ occurrenceDate: occurrenceDate.toISOString() });

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe('Schedule rule not found');
        });

        it('should return 400 if occurrenceDate is missing', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({}); // Missing occurrenceDate

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Occurrence date is required.');
        });

        it('should return 400 if occurrenceDate is invalid', async () => {
            const response = await request(app)
                .post(`/schedules/${scheduleRule._id}/exception`)
                .send({ occurrenceDate: 'not-a-valid-date' });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Invalid occurrence date format provided.');
        });

         // Route doesn't validate ID format
        // it('should return 500 for invalid schedule ID format', async () => { ... });
    });

});

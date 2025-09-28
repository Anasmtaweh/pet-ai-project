const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');
const mongoose = require('mongoose'); // Import mongoose to check ObjectId validity
// GET /schedules/owner/:ownerId
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        // Validate that the ownerId is a valid MongoDB ObjectId format.
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ message: 'Invalid owner ID format' });
        }
        // Find all schedules associated with the given ownerId.
        const schedules = await Schedule.find({ owner: ownerId });
        // If no schedules are found, an empty array is returned, which is standard.
        res.json(schedules);
    } catch (error) {
        console.error("Error fetching schedules by owner:", error);
        res.status(500).json({ message: 'Server error fetching schedules' });
    }
});

// Route to add a new schedule.
// POST /schedules/add
router.post('/add', async (req, res) => {
    try {
        // Destructure all potential fields from the request body.
        const { title, start, end, type, repeat, repeatType, repeatDays, owner, exceptionDates } = req.body;

        // Perform basic validation for required fields.
        // More detailed validation (e.g., enum checks, date formats) is handled by Mongoose schema.
        if (!title || !start || !end || !type || !owner) {
             return res.status(400).json({ message: 'Missing required fields (title, start, end, type, owner)' });
        }
        // Validate that the owner ID is a valid MongoDB ObjectId format.
        if (!mongoose.Types.ObjectId.isValid(owner)) {
            return res.status(400).json({ message: 'Invalid owner ID format' });
        }

        // Create a new Schedule instance with the provided data.
        const newSchedule = new Schedule({
            title,
            start,
            end,
            type,
            repeat,
            repeatType,
            repeatDays,
            owner,
            exceptionDates
        });
        // Save the new schedule to the database. Mongoose schema validation runs at this point.
        await newSchedule.save();

        // Log the schedule addition activity.
        await RecentActivity.create({
            type: 'schedule_added',
            details: `New schedule added: ${newSchedule.title}`,
            userId: newSchedule.owner,
            scheduleId: newSchedule._id,
        });
        // Respond with the newly created schedule document and a 201 status.
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error("Error adding schedule:", error);
        // Handle Mongoose validation errors specifically.
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error adding schedule' });
    }
});

// Route to update an existing schedule by its ID.
// PUT /schedules/:id
router.put('/:id', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        // Validate that the scheduleId is a valid MongoDB ObjectId format.
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
        }

        // Destructure only the fields allowed for update from the request body.
        const { title, start, end, type, repeat, repeatType, repeatDays } = req.body;
        // Sanitize and validate update data
        const updateData = {};
        if (typeof title === 'string') updateData.title = title;
        if (typeof start === 'string' || start instanceof Date) updateData.start = start;
        if (typeof end === 'string' || end instanceof Date) updateData.end = end;
        if (typeof type === 'string') updateData.type = type;
        if (typeof repeat === 'boolean') updateData.repeat = repeat;
        if (typeof repeatType === 'string') updateData.repeatType = repeatType;
        // repeatDays should be an array of (strings or numbers), but not objects
        if (Array.isArray(repeatDays) && repeatDays.every(d => typeof d === 'string' || typeof d === 'number')) updateData.repeatDays = repeatDays;

        // If no valid update data is provided, return a 400 error.
        if (Object.keys(updateData).length === 0) {
             return res.status(400).json({ message: 'No update data provided.' });
        }

        // Find the schedule by ID and update it with the provided data.
        // 'new: true' option returns the modified document rather than the original.
        // 'runValidators: true' ensures Mongoose schema validations are run on the update.
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            scheduleId,
            updateData,
            { new: true, runValidators: true }
        );

        // If the schedule is not found, return a 404 error.
        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        // Optional: Consider adding recent activity logging for schedule updates.
        res.json(updatedSchedule);
    } catch (error) {
        console.error("Error updating schedule:", error);
        // Handle Mongoose validation errors specifically.
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error updating schedule' });
    }
});

// Route to delete a schedule by its ID.
// DELETE /schedules/:id
router.delete('/:id', deleteScheduleLimiter, async (req, res) => {
    try {
         const scheduleId = req.params.id;
         // Validate that the scheduleId is a valid MongoDB ObjectId format.
         if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
         }

        // Find the schedule by ID and delete it.
        // findByIdAndDelete returns the document if found and deleted, or null otherwise.
        const schedule = await Schedule.findByIdAndDelete(scheduleId);
        // If the schedule is not found, return a 404 error.
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        // Log the schedule deletion activity.
        await RecentActivity.create({
            type: 'schedule_deleted',
            details: `Schedule deleted: ${schedule.title}`,
            userId: schedule.owner,
            scheduleId: schedule._id, // Use the ID from the deleted document for the log.
        });
        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).json({ message: 'Server error deleting schedule' });
    }
});

// Route to add an exception date to a repeating schedule rule.
// This marks a specific occurrence of a repeating event as skipped.
// POST /schedules/:id/exception
router.post('/:id/exception', async (req, res) => {
    try {
        const ruleId = req.params.id; // The ID of the schedule rule.
        // Validate that the ruleId is a valid MongoDB ObjectId format.
        if (!mongoose.Types.ObjectId.isValid(ruleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
        }
        // Expecting the specific start date/time of the occurrence to be marked as an exception.
        const { occurrenceDate } = req.body;

        // Validate that occurrenceDate is provided.
        if (!occurrenceDate) {
            return res.status(400).json({ message: 'Occurrence date is required.' });
        }

        // Validate that occurrenceDate is a valid date string.
        const validDate = new Date(occurrenceDate);
        if (isNaN(validDate)) {
             return res.status(400).json({ message: 'Invalid occurrence date format provided.' });
        }

        // Find the schedule rule by ID and add the validDate to its exceptionDates array.
        // '$addToSet' ensures that the date is only added if it's not already present, preventing duplicates.
        // 'new: true' option returns the modified document.
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            ruleId,
            { $addToSet: { exceptionDates: validDate } },
            { new: true }
        );

        // If the schedule rule is not found, return a 404 error.
        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule rule not found' });
        }

        res.json({ message: 'Occurrence marked as exception.', schedule: updatedSchedule });

    } catch (error) {
        console.error("Error adding schedule exception:", error);
        res.status(500).json({ message: 'Server error adding exception' });
    }
});

module.exports = router;




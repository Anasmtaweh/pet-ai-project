const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const RecentActivity = require('../models/RecentActivity');

// Get all schedules for a user
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const schedules = await Schedule.find({ owner: req.params.ownerId });
        res.json(schedules);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a new schedule
router.post('/add', async (req, res) => {
    try {
        const { title, start, end, type, repeat, repeatType, repeatDays, owner } = req.body;
        const newSchedule = new Schedule({ title, start, end, type, repeat, repeatType, repeatDays, owner });
        await newSchedule.save();
        // Add recent activity
        await RecentActivity.create({
            type: 'schedule_added',
            details: `New schedule added: ${newSchedule.title}`,
            userId: newSchedule.owner,
            scheduleId: newSchedule._id,
        });
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a schedule
router.put('/:id', async (req, res) => {
    try {
        const { title, start, end, type, repeat, repeatType, repeatDays } = req.body;
        const updatedSchedule = await Schedule.findByIdAndUpdate(req.params.id, { title, start, end, type, repeat, repeatType, repeatDays }, { new: true });
        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        res.json(updatedSchedule);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a schedule
router.delete('/:id', async (req, res) => {
    try {
        const schedule = await Schedule.findByIdAndDelete(req.params.id);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        // Add recent activity
        await RecentActivity.create({
            type: 'schedule_deleted',
            details: `Schedule deleted: ${schedule.title}`,
            userId: schedule.owner,
            scheduleId: schedule._id,
        });
        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/exception', async (req, res) => {
    try {
        const { occurrenceDate } = req.body; // Expecting the specific start date of the occurrence
        const ruleId = req.params.id;

        if (!occurrenceDate) {
            return res.status(400).json({ message: 'Occurrence date is required.' });
        }

        const validDate = new Date(occurrenceDate);
        if (isNaN(validDate)) {
             return res.status(400).json({ message: 'Invalid occurrence date format provided.' });
        }

        // Find the rule and add the date to the exceptions array
        // Using $addToSet to prevent duplicate exception dates
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            ruleId,
            { $addToSet: { exceptionDates: validDate } },
            { new: true } // Return the updated document
        );

        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule rule not found' });
        }

        // Optional: Add recent activity? Maybe not necessary for exceptions.

        res.json({ message: 'Occurrence marked as exception.', schedule: updatedSchedule });

    } catch (error) {
        console.error("Error adding schedule exception:", error);
        res.status(500).json({ message: 'Server error adding exception' });
    }
});

module.exports = router;


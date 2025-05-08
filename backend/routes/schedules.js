// c:\Users\Anas\Desktop\backend\routes\schedules.js

const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const User = require('../models/User'); 
const RecentActivity = require('../models/RecentActivity');
const mongoose = require('mongoose'); // Import mongoose to check ObjectId validity

// Get all schedules for a user
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        // Add validation for ownerId format
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ message: 'Invalid owner ID format' });
        }
        const schedules = await Schedule.find({ owner: ownerId });
        // No need for 404, return empty array if no schedules found (common practice)
        res.json(schedules);
    } catch (error) {
        console.error("Error fetching schedules by owner:", error);
        res.status(500).json({ message: 'Server error fetching schedules' });
    }
});

// Add a new schedule
router.post('/add', async (req, res) => {
    try {
        // Destructure all potential fields from the body
        const { title, start, end, type, repeat, repeatType, repeatDays, owner, exceptionDates } = req.body;

        // Basic validation (Mongoose validation will handle more)
        if (!title || !start || !end || !type || !owner) {
             return res.status(400).json({ message: 'Missing required fields (title, start, end, type, owner)' });
        }
        // Optional: Validate owner ID format
        if (!mongoose.Types.ObjectId.isValid(owner)) {
            return res.status(400).json({ message: 'Invalid owner ID format' });
        }
 

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
        await newSchedule.save(); // Mongoose validation runs here

        // Add recent activity
        await RecentActivity.create({
            type: 'schedule_added',
            details: `New schedule added: ${newSchedule.title}`,
            userId: newSchedule.owner,
            scheduleId: newSchedule._id,
        });
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error("Error adding schedule:", error);
        // Handle Mongoose validation errors more specifically
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error adding schedule' });
    }
});

// Update a schedule
router.put('/:id', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        // Add validation for scheduleId format
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
        }

        // Destructure only the fields allowed for update
        const { title, start, end, type, repeat, repeatType, repeatDays } = req.body;
        const updateData = { title, start, end, type, repeat, repeatType, repeatDays };

        // Remove undefined fields from updateData to avoid overwriting with null
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        if (Object.keys(updateData).length === 0) {
             return res.status(400).json({ message: 'No update data provided.' });
        }

        // ---  Add runValidators: true ---
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            scheduleId,
            updateData, // Pass only the fields to update
            { new: true, runValidators: true } // Return updated doc AND run validators
        );
        // --- End  ---

        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        // Optional: Add recent activity for update?
        res.json(updatedSchedule);
    } catch (error) {
        console.error("Error updating schedule:", error);
         // Handle Mongoose validation errors more specifically
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Server error updating schedule' });
    }
});

// Delete a schedule
router.delete('/:id', async (req, res) => {
    try {
         const scheduleId = req.params.id;
         // Add validation for scheduleId format
         if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
         }

        // Use findByIdAndDelete to get the doc before deleting (for logging)
        const schedule = await Schedule.findByIdAndDelete(scheduleId);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        // Add recent activity
        await RecentActivity.create({
            type: 'schedule_deleted',
            details: `Schedule deleted: ${schedule.title}`,
            userId: schedule.owner,
            scheduleId: schedule._id, // Use the ID from the deleted doc
        });
        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).json({ message: 'Server error deleting schedule' });
    }
});

// Add an exception date to a schedule rule
router.post('/:id/exception', async (req, res) => {
    try {
        const ruleId = req.params.id;
        // Add validation for ruleId format
        if (!mongoose.Types.ObjectId.isValid(ruleId)) {
            return res.status(400).json({ message: 'Invalid schedule ID format' });
        }
        const { occurrenceDate } = req.body; // Expecting the specific start date of the occurrence

        if (!occurrenceDate) {
            return res.status(400).json({ message: 'Occurrence date is required.' });
        }

        const validDate = new Date(occurrenceDate);
        if (isNaN(validDate)) {
             return res.status(400).json({ message: 'Invalid occurrence date format provided.' });
        }

        
        // Using $addToSet to prevent duplicate exception dates
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            ruleId,
            { $addToSet: { exceptionDates: validDate } },
            { new: true } // Return the updated document
        );

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



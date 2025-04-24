// src/pages/Scheduler.js
// --- VERSION WITH DELETE OCCURRENCE/SERIES CHOICE & INPUT FIX ---
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment'; // Ensure moment is installed
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Alert from 'react-bootstrap/Alert';
import styles from './Scheduler.module.css';
import axios from 'axios';

// --- Helper to calculate the wide data window ---
const calculateDataWindow = (centerDate) => {
    const daysBuffer = 45; // Fetch data for +/- 45 days around the center date
    return {
        start: moment(centerDate).subtract(daysBuffer, 'days').startOf('day').toDate(),
        end: moment(centerDate).add(daysBuffer, 'days').endOf('day').toDate(),
    };
};
// --- End Helper ---

const localizer = momentLocalizer(moment);

// --- REVISED generateOccurrences (Checks exceptions) ---
const generateOccurrences = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    if (!rule || !rule.start || !rule.end || !rule._id) {
        // console.warn("Skipping occurrence generation for invalid/incomplete rule:", rule);
        return occurrences;
    }

    // Prepare exception dates for quick lookup (convert to valueOf for reliable comparison)
    const exceptionTimestamps = new Set(
        (rule.exceptionDates || []).map(date => moment(date).valueOf())
    );

    const ruleStartDate = moment(rule.start).startOf('day');
    const ruleEndDate = moment(rule.end).startOf('day');
    const ruleStartTime = moment(rule.start);
    const ruleEndTime = moment(rule.end);

    if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) {
        // console.warn(`Skipping rule "${rule.title}" (${rule._id}) due to invalid date range.`);
        return occurrences;
    }
    if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
        //  console.warn(`Skipping rule "${rule.title}" (${rule._id}) due to invalid time.`);
         return occurrences;
    }

    // Calculate daily duration correctly, handling overnight events
    const tempStart = moment().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
    const tempEnd = moment().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
    if (tempEnd.isSameOrBefore(tempStart)) { tempEnd.add(1, 'day'); } // Adjust if end time is on the next day
    const dailyDuration = moment.duration(tempEnd.diff(tempStart));

    // Determine loop start date (max of rule start or window start)
    let current = ruleStartDate.clone();
    if (current.isBefore(windowStart)) { current = windowStart.clone().startOf('day'); }

    // Determine loop end date (min of rule end or window end)
    const loopEndDate = moment.min(windowEnd, ruleEndDate);

    // Loop through days in the relevant range
    while (current.isSameOrBefore(loopEndDate)) {
        let occursOnThisDay = false;
        if (rule.repeat) {
            if (rule.repeatType === 'daily') {
                occursOnThisDay = true;
            } else if (rule.repeatType === 'weekly' && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(current.format('dddd'))) {
                occursOnThisDay = true;
            }
        } else {
            // For non-repeating events, only occurs on the rule's start date
            if (current.isSame(ruleStartDate, 'day')) {
                occursOnThisDay = true;
            }
        }

        if (occursOnThisDay) {
            // Calculate the specific start and end time for this day's occurrence
            const occurrenceStart = current.clone().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second() });
            const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

            // Check against exceptions using valueOf for reliable comparison
            if (!exceptionTimestamps.has(occurrenceStart.valueOf())) {
                occurrences.push({
                    title: rule.title,
                    type: rule.type,
                    originalRuleId: rule._id, // Keep original rule ID
                    start: occurrenceStart.toDate(),
                    end: occurrenceEnd.toDate(),
                    // Pass necessary rule properties for eventPropGetter or display
                    repeat: rule.repeat,
                    repeatType: rule.repeatType,
                    repeatDays: rule.repeatDays,
                });
            } else {
                 // console.log(`Skipping excepted occurrence for rule ${rule._id} on ${occurrenceStart.format()}`);
            }
        }
        current.add(1, 'day'); // Move to the next day
    }
    return occurrences;
};
// --- End REVISED generateOccurrences ---


function Scheduler() {
    useEffect(() => {
        document.title = "MISHTIKA - Scheduler";
    }, []);

    // State
    const [eventRules, setEventRules] = useState([]);
    const [displayEvents, setDisplayEvents] = useState([]);

    // --- NEW: Separate state for calendar navigation date ---
    const initialDate = new Date(); // Today's date
    const [calendarDate, setCalendarDate] = useState(initialDate);
    // --- END NEW ---

    // --- MODIFIED: Initial view range based on initialDate and default view ---
    const [currentViewRange, setCurrentViewRange] = useState(calculateDataWindow(initialDate));
    // --- END MODIFIED ---
    const [showAddEditModal, setShowAddEditModal] = useState(false); // Modal for Add/Edit
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // Modal for Delete Choice
    const [selectedOccurrence, setSelectedOccurrence] = useState(null); // Specific calendar event clicked
    const [editEventRule, setEditEventRule] = useState(null); // Rule being edited OR rule associated with delete action
    const [newEvent, setNewEvent] = useState({ // State for the Add/Edit form
        title: '',
        start: moment().startOf('hour').add(1, 'hour'), // Default start time
        end: moment().startOf('hour').add(2, 'hour'),   // Default end time
        type: 'meal',
        repeat: false,
        repeatType: 'daily',
        repeatDays: [],
    });
    const [modalError, setModalError] = useState(''); // Error for Add/Edit modal
    const [deleteError, setDeleteError] = useState(''); // Error for Delete modal

    // Constants and User Info
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const token = localStorage.getItem('token');
    let owner = null;
    try {
        if (token) {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            owner = decodedToken.id;
        }
    } catch (e) {
        console.error("Error decoding token:", e);
        // Handle invalid token case if necessary (e.g., redirect to login)
    }

    // --- Fetch original event rules ---
    const fetchEventRules = useCallback(async () => {
        if (!owner || !token) {
            console.log("Cannot fetch rules: Owner ID or token missing.");
            setEventRules([]); // Clear rules if not logged in
            return;
        }
        console.log("Fetching event rules...");
        try {
            const response = await axios.get(`https://mishtika.duckdns.org/schedules/owner/${owner}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Fetched rules:", response.data);
            setEventRules(response.data || []); // Ensure it's an array
        } catch (error) {
            console.error('Error fetching event rules:', error);
            setEventRules([]); // Set empty on error
        }
    }, [owner, token]);

    // Fetch rules on initial load or when owner/token changes
    useEffect(() => {
        fetchEventRules();
    }, [fetchEventRules]);

    // --- Generate display events whenever rules or view range change ---
    useEffect(() => {
        console.log("Regenerating display events. Rules:", eventRules.length, "Range:", currentViewRange.start, currentViewRange.end);
        const generated = [];
        const windowStartMoment = moment(currentViewRange.start);
        const windowEndMoment = moment(currentViewRange.end);

        eventRules.forEach(rule => {
            // Use the revised generateOccurrences function with the current view range
            const occurrences = generateOccurrences(rule, windowStartMoment, windowEndMoment);
            generated.push(...occurrences);
        });
        console.log("Generated display events:", generated.length);
        setDisplayEvents(generated);
    }, [eventRules, currentViewRange]); // Dependencies: run when rules or view range update

    // --- Modal Handling ---
    // Add/Edit Modal
    const handleAddEditModalClose = () => {
        setShowAddEditModal(false);
        setEditEventRule(null);
        setModalError('');
        // Reset form state to defaults
        setNewEvent({
            title: '',
            start: moment().startOf('hour').add(1, 'hour'),
            end: moment().startOf('hour').add(2, 'hour'),
            type: 'meal',
            repeat: false,
            repeatType: 'daily',
            repeatDays: [],
        });
    };

    const handleAddEditModalShow = (ruleToEdit = null) => { // Default to null for adding
        setModalError('');
        if (!ruleToEdit) { // Adding new
            console.log("Opening modal to add new rule.");
            setEditEventRule(null);
            // Reset form state to defaults
            setNewEvent({
                title: '',
                start: moment().startOf('hour').add(1, 'hour'),
                end: moment().startOf('hour').add(2, 'hour'),
                type: 'meal',
                repeat: false,
                repeatType: 'daily',
                repeatDays: [],
            });
        } else { // Editing existing rule
            console.log("Opening modal to edit rule:", ruleToEdit);
            setEditEventRule(ruleToEdit);
            // Populate form with rule data, ensuring moment objects for dates
            setNewEvent({
                title: ruleToEdit.title || '',
                start: ruleToEdit.start ? moment(ruleToEdit.start) : moment().startOf('hour').add(1, 'hour'),
                end: ruleToEdit.end ? moment(ruleToEdit.end) : moment().startOf('hour').add(2, 'hour'),
                type: ruleToEdit.type || 'meal',
                repeat: ruleToEdit.repeat || false,
                repeatType: ruleToEdit.repeatType || 'daily',
                repeatDays: Array.isArray(ruleToEdit.repeatDays) ? ruleToEdit.repeatDays : [],
            });
        }
        setShowAddEditModal(true);
    };

    // Delete Confirmation Modal
    const handleDeleteConfirmModalClose = () => {
        setShowDeleteConfirmModal(false);
        setSelectedOccurrence(null); // Clear selected occurrence
        setEditEventRule(null); // Clear associated rule
        setDeleteError('');
    };

    const handleDeleteConfirmModalShow = (eventOrRule) => {
        setDeleteError('');
        const ruleId = eventOrRule.originalRuleId || eventOrRule._id; // Get ID from calendar event or rule list item
        const rule = eventRules.find(r => r._id === ruleId);

        if (!rule) {
            console.error("Cannot show delete confirm: Rule not found for", eventOrRule);
            setDeleteError("Cannot delete: Associated rule not found. It might have been deleted already.");
            setShowDeleteConfirmModal(true); // Show modal with error
            return;
        }

        setEditEventRule(rule); // Store the rule associated with the delete action

        // Check if it's a specific occurrence clicked on the calendar
        if (eventOrRule.originalRuleId && eventOrRule.start) {
             console.log("Showing delete choice for occurrence:", eventOrRule);
             setSelectedOccurrence(eventOrRule); // Store the specific occurrence details
             setShowDeleteConfirmModal(true); // Show the choice modal
        } else { // It's a rule from the list (or invalid event)
             console.log("Showing delete choice for entire series (rule):", rule);
             setSelectedOccurrence(null); // No specific occurrence
             setShowDeleteConfirmModal(true); // Show the choice modal
        }
    };
    // --- End Modal Handling ---


    // --- Input change handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDateChange = (e, field) => {
        const { value } = e.target;
        // When changing datetime-local, parse it into a moment object
        setNewEvent(prev => ({
            ...prev,
            [field]: moment(value) // Store as moment object
        }));
    };

    const handleRepeatChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'repeat') {
            // Handle the main repeat checkbox
            setNewEvent(prev => ({
                ...prev,
                repeat: checked,
                // Reset dependent fields if repeat is turned off
                repeatType: checked ? prev.repeatType : 'daily',
                repeatDays: checked ? prev.repeatDays : []
            }));
        } else if (name === 'repeatType') {
            // Handle the repeat type dropdown (daily/weekly)
            setNewEvent(prev => ({
                ...prev,
                repeatType: value,
                // Reset days if switching away from weekly
                repeatDays: value === 'weekly' ? prev.repeatDays : []
            }));
        } else if (name === 'repeatDays') {
            // Handle the individual day checkboxes for weekly repeat
            const day = value;
            setNewEvent(prev => ({
                ...prev,
                repeatDays: checked
                    ? [...prev.repeatDays, day] // Add day if checked
                    : prev.repeatDays.filter(d => d !== day) // Remove day if unchecked
            }));
        }
    };
    // --- End Input change handlers ---

    // --- Validation Function ---
    const validateEvent = () => {
        setModalError(''); // Clear previous errors
        if (!newEvent.title.trim()) {
            setModalError('Title is required.');
            return false;
        }
        if (!newEvent.start || !newEvent.start.isValid()) {
            setModalError('Valid start date and time are required.');
            return false;
        }
        if (!newEvent.end || !newEvent.end.isValid()) {
            setModalError('Valid end date and time are required.');
            return false;
        }
        // Check if end is after start (considering only time for repeating, full date/time otherwise)
        if (newEvent.repeat) {
            // For repeating, compare only time of day. Handle overnight.
            const startTime = moment().set({ hour: newEvent.start.hour(), minute: newEvent.start.minute() });
            const endTime = moment().set({ hour: newEvent.end.hour(), minute: newEvent.end.minute() });
            if (endTime.isSameOrBefore(startTime)) {
                 // Allow overnight if end date is explicitly after start date (though UI might not support this well)
                 if (!newEvent.end.isAfter(newEvent.start, 'day')) {
                     // If times imply overnight but dates don't, it's an error unless duration is exactly 24h?
                     // Simpler: just ensure end time is after start time for daily duration calculation
                     // Let's assume for now end time must be after start time on the same day for simplicity
                     // Or handle overnight duration calculation correctly in generateOccurrences
                     // For validation: Check if duration is positive
                     const tempS = moment().set({ hour: newEvent.start.hour(), minute: newEvent.start.minute() });
                     const tempE = moment().set({ hour: newEvent.end.hour(), minute: newEvent.end.minute() });
                     if (tempE.isSameOrBefore(tempS)) {
                         setModalError('For repeating events, end time must be after start time (overnight ranges not fully supported in this simple validation).');
                         // return false; // Allow for now, rely on generation logic
                     }
                 }
            }
            // Check date range for repeating events
            if (newEvent.end.isBefore(newEvent.start, 'day')) {
                 setModalError('For repeating events, the end date cannot be before the start date.');
                 return false;
            }

        } else {
            // For non-repeating, end datetime must be strictly after start datetime
            if (newEvent.end.isSameOrBefore(newEvent.start)) {
                setModalError('End date and time must be after start date and time.');
                return false;
            }
        }

        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            setModalError('Please select at least one day for weekly repeat.');
            return false;
        }
        return true; // Validation passed
    };
    // --- End Validation Function ---


    // --- CRUD Operations ---
    const handleAddEvent = async () => {
        if (!validateEvent()) return; // Validate before sending
        const payload = {
            title: newEvent.title.trim(),
            // Send dates as ISO strings for backend consistency
            start: newEvent.start.toISOString(),
            end: newEvent.end.toISOString(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            // Only include repeat details if repeat is true
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
            owner // Add owner ID
        };
        console.log("Sending new schedule rule:", payload);
        try {
            await axios.post('https://mishtika.duckdns.org/schedules/add', payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules(); // Refresh rules list
            handleAddEditModalClose(); // Close Add/Edit modal
        } catch (error) {
            console.error('Error adding event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to add event.');
        }
    };

    const handleEditEvent = async () => {
        if (!validateEvent() || !editEventRule) { // Validate and ensure rule exists
             if (!editEventRule) setModalError("Cannot save, no event rule is being edited.");
             return;
        }
        const payload = {
            title: newEvent.title.trim(),
            // Send dates as ISO strings
            start: newEvent.start.toISOString(),
            end: newEvent.end.toISOString(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            // Only include repeat details if repeat is true
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
        };
        // Clean up payload based on repeat status (important for PUT)
        if (!newEvent.repeat) {
            payload.repeatType = null; // Explicitly set to null or undefined if not repeating
            payload.repeatDays = [];
        } else if (newEvent.repeatType !== 'weekly') {
            payload.repeatDays = [];
        }
        console.log("Updating schedule rule:", editEventRule._id, payload);
        try {
            await axios.put(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules(); // Refresh rules list
            handleAddEditModalClose(); // Close Add/Edit modal
        } catch (error) {
            console.error('Error updating event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to update event.');
        }
    };

    // Delete Handler for "Entire Series"
    const handleDeleteSeries = async () => {
        if (!editEventRule || !editEventRule._id) {
            setDeleteError("Cannot delete series: No rule selected."); return;
        }
        setDeleteError(''); // Clear previous errors
        console.log("Deleting entire series (rule):", editEventRule._id);
        try {
            await axios.delete(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules(); // Refresh rules from backend
            handleDeleteConfirmModalClose(); // Close the confirmation modal
        } catch (error) {
            console.error('Error deleting event rule series:', error);
            setDeleteError(error.response?.data?.message || 'Failed to delete event series.');
            // Keep modal open on error to show message
        }
    };

    // Delete Handler for "Only This Occurrence"
    const handleDeleteOccurrence = async () => {
        // Ensure we have the occurrence details and the associated rule ID
        if (!selectedOccurrence || !selectedOccurrence.originalRuleId || !selectedOccurrence.start) {
             setDeleteError("Cannot delete occurrence: Invalid event data selected."); return;
        }
        setDeleteError(''); // Clear previous errors
        const ruleId = selectedOccurrence.originalRuleId;
        const occurrenceDate = selectedOccurrence.start; // The specific start time of the clicked event

        console.log(`Adding exception for rule ${ruleId} on ${moment(occurrenceDate).format()}`);
        try {
            // Call the new backend endpoint
            await axios.post(`https://mishtika.duckdns.org/schedules/${ruleId}/exception`,
                { occurrenceDate: moment(occurrenceDate).toISOString() }, // Send date as ISO string
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchEventRules(); // Refresh rules to get updated exceptions array
            handleDeleteConfirmModalClose(); // Close the confirmation modal
        } catch (error) {
             console.error('Error adding exception for occurrence:', error);
             setDeleteError(error.response?.data?.message || 'Failed to delete this occurrence.');
             // Keep modal open on error to show message
        }
    };
    // --- End CRUD ---


    // --- eventPropGetter ---
    const eventPropGetter = (event) => {
        let className = '';
        switch (event.type) {
            case 'meal': className = styles.eventMeal; break;
            case 'vet': className = styles.eventVet; break;
            case 'play': className = styles.eventPlay; break;
            case 'sleep': className = styles.eventSleep; break;
            case 'medication': className = styles.eventMedication; break;
            default: className = styles.eventDefault;
        }
        return { className };
    };
    // --- End eventPropGetter ---

    // --- handleSelectEvent (Calendar Click) ---
    const handleSelectEvent = (event) => {
        console.log("Event selected on calendar:", event);
        // Show the delete confirmation modal instead of the edit modal
        handleDeleteConfirmModalShow(event);
    };
    // --- End handleSelectEvent ---

    // --- Handle Calendar View/Range Change ---
    const handleNavigate = (newDate, view) => {
        console.log("Navigate:", newDate, view);
        setCalendarDate(newDate); // Update the calendar's focus date

        // Update the data fetching range based on the new date and the *current* view
        // Note: 'view' passed here might be the old view if only date changed
        // It's safer to derive range from newDate and the actual current view setting if available
        // Or just use a standard range like month for simplicity when navigating
        const newStart = moment(newDate).startOf('month').toDate(); // Fetch +/- 1 month around navigated date
        const newEnd = moment(newDate).endOf('month').toDate();
        // Or use the view:
        // const newStart = moment(newDate).startOf(view).toDate();
        // const newEnd = moment(newDate).endOf(view).toDate();
        setCurrentViewRange(calculateDataWindow(newDate));
    };

    const handleView = (view) => {
        console.log("View Change:", view);
        // When view changes, the calendarDate usually stays the same.
        // We just need to ensure the data range remains the wide one.
        // Recalculating based on current calendarDate ensures consistency.
        setCurrentViewRange(calculateDataWindow(calendarDate)); // Use the wide window calculation
        // Note: react-big-calendar might internally adjust its display range
        // based on the view, but our data source (displayEvents) remains wide.
    };

    // --- End Handle Calendar View/Range Change ---


    // --- Render ---
    return (
        <Container className={`${styles.schedulerContainer} mt-5`}>
            <h1 className={styles.schedulerTitle}>Scheduler</h1>
            {/* Button opens Add/Edit Modal */}
            <Button variant="primary" onClick={() => handleAddEditModalShow(null)} className={styles.addEventButton}>
                Add Event Rule
            </Button>
            <div className={styles.calendarContainer}>
                <Calendar
                    localizer={localizer}
                    events={displayEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventPropGetter}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    defaultView={Views.MONTH}
                    popup
                    onNavigate={handleNavigate}
                    onView={handleView}
                    date={calendarDate} // Set the calendar's focus date
                    // --- ADD THIS PROP ---
                    length={30} // Show 30 days in Agenda view
                    // --- END ADD ---
                />
            </div>

            {/* Event List shows the base rules */}
            <h2 className={styles.eventListTitle}>Event Rules</h2>
            <ul className={styles.eventList}>
                {eventRules.length > 0 ? eventRules.map((rule) => (
                    <li key={rule._id} className={styles.eventListItem}>
                        <strong className={styles.eventTitle}>{rule.title}</strong> - {rule.type}
                        {rule.repeat && ` (Repeats ${rule.repeatType}${rule.repeatType === 'weekly' ? ` on ${rule.repeatDays.join(', ')}` : ''})`}
                        <br />
                        <span className={styles.eventTime}>
                            Range: {moment(rule.start).format('MMM Do YYYY')} to {moment(rule.end).format('MMM Do YYYY')} <br/>
                            Time: {moment(rule.start).format('h:mm a')} - {moment(rule.end).format('h:mm a')}
                        </span>
                        <div className={styles.eventButtons}>
                            {/* Edit button opens Add/Edit Modal */}
                            <Button variant="primary" size="sm" onClick={() => handleAddEditModalShow(rule)}>Edit Rule</Button>
                            {/* Delete button opens Delete Confirm Modal */}
                            <Button variant="danger" size="sm" className="ms-2" onClick={() => handleDeleteConfirmModalShow(rule)}>Delete</Button>
                        </div>
                    </li>
                )) : <li>No event rules found. Add one using the button above.</li>}
            </ul>

            {/* --- Add/Edit Modal --- */}
            <Modal show={showAddEditModal} onHide={handleAddEditModalClose}>
                <Modal.Header closeButton>
                    <Modal.Title>{editEventRule ? 'Edit Event Rule' : 'Add New Event Rule'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {modalError && <Alert variant="danger">{modalError}</Alert>}
                    <Form>
                        {/* Title */}
                        <Form.Group className="mb-3" controlId="formEventTitle">
                            <Form.Label>Title</Form.Label>
                            <Form.Control
                                type="text"
                                name="title"
                                id="formEventTitle"
                                value={newEvent.title}
                                onChange={handleInputChange}
                                required
                            />
                        </Form.Group>
                        {/* Type */}
                        <Form.Group className="mb-3" controlId="formEventType">
                            <Form.Label>Type</Form.Label>
                            <Form.Select name="type" id="formEventType" value={newEvent.type} onChange={handleInputChange}>
                                <option value="meal">Meal</option>
                                <option value="vet">Vet Appointment</option>
                                <option value="play">Play Time</option>
                                <option value="sleep">Sleep Time</option>
                                <option value="medication">Medication</option>
                            </Form.Select>
                        </Form.Group>
                        {/* Start Date/Time */}
                        <Form.Group className="mb-3" controlId="formEventStart">
                            <Form.Label>Start Date & Time</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                name="start"
                                id="formEventStart"
                                value={newEvent.start.format('YYYY-MM-DDTHH:mm')} // Format for input
                                onChange={(e) => handleDateChange(e, 'start')}
                                required
                            />
                        </Form.Group>
                        {/* End Date/Time */}
                        <Form.Group className="mb-3" controlId="formEventEnd">
                            <Form.Label>End Date & Time</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                name="end"
                                id="formEventEnd"
                                value={newEvent.end.format('YYYY-MM-DDTHH:mm')} // Format for input
                                onChange={(e) => handleDateChange(e, 'end')}
                                required
                            />
                            <Form.Text muted>
                                For repeating events, the date part defines the range, and the time part defines the daily duration.
                            </Form.Text>
                        </Form.Group>
                        {/* Repeat Checkbox */}
                        <Form.Group className="mb-3" controlId="formEventRepeat">
                            <Form.Check
                                type="checkbox"
                                name="repeat"
                                id="formEventRepeat"
                                label="Repeat this event within the date range"
                                checked={newEvent.repeat}
                                onChange={handleRepeatChange}
                            />
                        </Form.Group>
                        {/* Conditional Repeat Options */}
                        {newEvent.repeat && (
                            <>
                                {/* Repeat Type */}
                                <Form.Group className="mb-3" controlId="formEventRepeatType">
                                    <Form.Label>Repeat Type</Form.Label>
                                    <Form.Select name="repeatType" id="formEventRepeatType" value={newEvent.repeatType} onChange={handleRepeatChange}>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Specific days of the week</option>
                                    </Form.Select>
                                </Form.Group>
                                {/* Repeat Days (only if weekly) */}
                                {newEvent.repeatType === 'weekly' && (
                                    <Form.Group className="mb-3">
                                        <Form.Label>Days of the Week</Form.Label>
                                        <div>
                                            {daysOfWeek.map((day) => (
                                                <Form.Check
                                                    key={day}
                                                    inline
                                                    type="checkbox"
                                                    name="repeatDays"
                                                    value={day}
                                                    label={day}
                                                    id={`formEventRepeatDay-${day}`} // Unique ID for each checkbox
                                                    checked={newEvent.repeatDays.includes(day)}
                                                    onChange={handleRepeatChange}
                                                />
                                            ))}
                                        </div>
                                    </Form.Group>
                                )}
                            </>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleAddEditModalClose}>Close</Button>
                    <Button variant="primary" onClick={editEventRule ? handleEditEvent : handleAddEvent}>
                        {editEventRule ? 'Save Rule Changes' : 'Add Event Rule'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* --- Delete Confirmation Modal --- */}
            <Modal show={showDeleteConfirmModal} onHide={handleDeleteConfirmModalClose} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {deleteError && <Alert variant="danger">{deleteError}</Alert>}
                    {selectedOccurrence ? (
                        // Message when clicking a specific occurrence on the calendar
                        <>
                            <p>Choose delete option for the event:</p>
                            <p><strong>"{editEventRule?.title}"</strong> on <strong>{moment(selectedOccurrence.start).format('MMM Do YYYY, h:mm a')}</strong>?</p>
                        </>
                    ) : (
                        // Message when clicking delete on a rule from the list
                        <p>Are you sure you want to delete the entire series for <strong>"{editEventRule?.title}"</strong>?</p>
                    )}
                </Modal.Body>
                <Modal.Footer className="justify-content-between"> {/* Layout buttons */}
                    <div> {/* Group occurrence/series delete buttons */}
                        {selectedOccurrence && editEventRule?.repeat && ( // Only show if it's a repeating event occurrence
                            <Button variant="warning" onClick={handleDeleteOccurrence} className="me-2">
                                Delete Only This Occurrence
                            </Button>
                        )}
                        {/* Always show "Delete Series" */}
                        <Button variant="danger" onClick={handleDeleteSeries}>
                            Delete Entire Series
                        </Button>
                    </div>
                    <Button variant="secondary" onClick={handleDeleteConfirmModalClose}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>
            {/* --- End Delete Confirmation Modal --- */}

        </Container>
    );
}

export default Scheduler;

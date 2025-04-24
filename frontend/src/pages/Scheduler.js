// src/pages/Scheduler.js
// --- VERSION WITH DELETE OCCURRENCE/SERIES CHOICE ---
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

const localizer = momentLocalizer(moment);

// --- REVISED generateOccurrences (Checks exceptions) ---
const generateOccurrences = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    if (!rule || !rule.start || !rule.end || !rule._id) {
        // console.warn("Skipping occurrence generation for invalid/incomplete rule:", rule);
        return occurrences;
    }

    // --- ADDED: Prepare exception dates for quick lookup ---
    const exceptionTimestamps = new Set(
        (rule.exceptionDates || []).map(date => moment(date).valueOf())
    );
    // --- END ADDED ---

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

    const tempStart = moment().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
    const tempEnd = moment().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
    if (tempEnd.isSameOrBefore(tempStart)) { tempEnd.add(1, 'day'); }
    const dailyDuration = moment.duration(tempEnd.diff(tempStart));

    let current = ruleStartDate.clone();
    if (current.isBefore(windowStart)) { current = windowStart.clone().startOf('day'); }
    const loopEndDate = moment.min(windowEnd, ruleEndDate);

    while (current.isSameOrBefore(loopEndDate)) {
        let occursOnThisDay = false;
        if (rule.repeat) {
            if (rule.repeatType === 'daily') occursOnThisDay = true;
            else if (rule.repeatType === 'weekly' && rule.repeatDays?.includes(current.format('dddd'))) occursOnThisDay = true;
        } else {
            if (current.isSame(ruleStartDate, 'day')) occursOnThisDay = true;
        }

        if (occursOnThisDay) {
            const occurrenceStart = current.clone().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second() });
            const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

            // --- ADDED: Check against exceptions ---
            if (!exceptionTimestamps.has(occurrenceStart.valueOf())) {
                occurrences.push({
                    title: rule.title,
                    type: rule.type,
                    originalRuleId: rule._id, // Keep original rule ID
                    start: occurrenceStart.toDate(),
                    end: occurrenceEnd.toDate(),
                    // Add other rule properties if needed by eventPropGetter or display
                    repeat: rule.repeat,
                    repeatType: rule.repeatType,
                    repeatDays: rule.repeatDays,
                });
            } else {
                 // console.log(`Skipping excepted occurrence for rule ${rule._id} on ${occurrenceStart.format()}`);
            }
            // --- END ADDED ---
        }
        current.add(1, 'day');
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
    const [showAddEditModal, setShowAddEditModal] = useState(false); // Modal for Add/Edit
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // Modal for Delete Choice
    const [selectedOccurrence, setSelectedOccurrence] = useState(null); // Specific calendar event clicked
    const [editEventRule, setEditEventRule] = useState(null); // Rule being edited OR rule associated with delete action
    const [newEvent, setNewEvent] = useState({ // State for the Add/Edit form
        title: '',
        start: moment().startOf('hour').add(1, 'hour'),
        end: moment().startOf('hour').add(2, 'hour'),
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
            setEventRules(response.data || []);
        } catch (error) {
            console.error('Error fetching event rules:', error);
            setEventRules([]);
        }
    }, [owner, token]);

    useEffect(() => {
        fetchEventRules();
    }, [fetchEventRules]);

    // --- Generate display events whenever rules change ---
    useEffect(() => {
        console.log("Regenerating display events from rules:", eventRules);
        const generated = [];
        // Define a reasonable window for displaying events (e.g., +/- 1 year)
        // Adjust as needed for performance vs. range
        const windowStart = moment().subtract(1, 'year').startOf('day');
        const windowEnd = moment().add(1, 'year').endOf('day');

        eventRules.forEach(rule => {
            // Use the revised generateOccurrences function
            const occurrences = generateOccurrences(rule, windowStart, windowEnd);
            generated.push(...occurrences);
        });
        console.log("Generated display events:", generated);
        setDisplayEvents(generated);
    }, [eventRules]); // Dependency: run when eventRules state updates

    // --- Modal Handling ---
    // Add/Edit Modal
    const handleAddEditModalClose = () => {
        setShowAddEditModal(false);
        setEditEventRule(null);
        setModalError('');
        setNewEvent({ // Reset form state
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
            setNewEvent({ // Reset form state
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
            setNewEvent({ // Populate form with rule data
                title: ruleToEdit.title || '',
                start: ruleToEdit.start ? moment(ruleToEdit.start) : moment(),
                end: ruleToEdit.end ? moment(ruleToEdit.end) : moment(),
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
            // Optionally show the modal with just the error and a close button
            setShowDeleteConfirmModal(true);
            return;
        }

        setEditEventRule(rule); // Store the rule associated with the delete action

        if (eventOrRule.originalRuleId && eventOrRule.start) { // It's a calendar event (occurrence) with a start time
             console.log("Showing delete choice for occurrence:", eventOrRule);
             setSelectedOccurrence(eventOrRule); // Store the specific occurrence details
             setShowDeleteConfirmModal(true); // Show the choice modal
        } else { // It's a rule from the list (or invalid event)
             console.log("Showing delete choice for entire series (rule):", rule);
             setSelectedOccurrence(null); // No specific occurrence
             setShowDeleteConfirmModal(true); // Show the choice modal (UI will handle disabling occurrence option)
        }
    };
    // --- End Modal Handling ---


    // --- Input change handlers (No changes needed) ---
    const handleInputChange = (e) => { /* ... */ };
    const handleDateChange = (e, field) => { /* ... */ };
    const handleRepeatChange = (e) => { /* ... */ };
    // --- End Input change handlers ---

    // --- Validation Function (No changes needed) ---
    const validateEvent = () => { /* ... */ };
    // --- End Validation Function ---


    // --- CRUD Operations ---
    const handleAddEvent = async () => {
        if (!validateEvent()) return;
        const payload = {
            title: newEvent.title.trim(),
            start: newEvent.start.toDate(),
            end: newEvent.end.toDate(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
            owner
        };
        console.log("Sending new schedule rule:", payload);
        try {
            await axios.post('https://mishtika.duckdns.org/schedules/add', payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules(); // Refresh rules
            handleAddEditModalClose(); // Close Add/Edit modal
        } catch (error) {
            console.error('Error adding event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to add event.');
        }
    };

    const handleEditEvent = async () => {
        if (!validateEvent() || !editEventRule) {
             if (!editEventRule) setModalError("Cannot save, no event rule is being edited.");
             return;
        }
        const payload = {
            title: newEvent.title.trim(),
            start: newEvent.start.toDate(),
            end: newEvent.end.toDate(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
        };
        // Clean up payload based on repeat status
        if (!newEvent.repeat) {
            payload.repeatType = undefined; // Or null, depending on backend preference
            payload.repeatDays = [];
        } else if (newEvent.repeatType !== 'weekly') {
            payload.repeatDays = [];
        }
        console.log("Updating schedule rule:", editEventRule._id, payload);
        try {
            await axios.put(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules(); // Refresh rules
            handleAddEditModalClose(); // Close Add/Edit modal
        } catch (error) {
            console.error('Error updating event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to update event.');
        }
    };

    // --- REVISED: Delete Handler for "Entire Series" ---
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

    // --- NEW: Delete Handler for "Only This Occurrence" ---
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
                { occurrenceDate: moment(occurrenceDate).toISOString() }, // Send date as ISO string for backend consistency
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


    // --- eventPropGetter (No changes needed) ---
    const eventPropGetter = (event) => { /* ... */ };

    // --- MODIFIED handleSelectEvent ---
    // This function is called when a user clicks on an event in the calendar
    const handleSelectEvent = (event) => {
        console.log("Event selected on calendar:", event);
        // Show the delete confirmation modal instead of the edit modal
        handleDeleteConfirmModalShow(event);
    };
    // --- End MODIFIED handleSelectEvent ---


    // --- Render ---
    return (
        <Container className={`${styles.schedulerContainer} mt-5`}>
            <h1 className={styles.schedulerTitle}>Scheduler</h1>
            {/* Button now opens Add/Edit Modal */}
            <Button variant="primary" onClick={() => handleAddEditModalShow(null)} className={styles.addEventButton}>
                Add Event Rule
            </Button>
            <div className={styles.calendarContainer}>
                <Calendar
                    localizer={localizer}
                    events={displayEvents} // Use the generated occurrences
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    onSelectEvent={handleSelectEvent} // This now triggers delete confirm modal
                    eventPropGetter={eventPropGetter}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    defaultView={Views.MONTH}
                    popup // Enable popup for "+X more"
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

            {/* --- Add/Edit Modal (Previously the only modal) --- */}
            <Modal show={showAddEditModal} onHide={handleAddEditModalClose}>
                <Modal.Header closeButton>
                    <Modal.Title>{editEventRule ? 'Edit Event Rule' : 'Add New Event Rule'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {modalError && <Alert variant="danger">{modalError}</Alert>}
                    <Form>
                        {/* Title */}
                        <Form.Group className="mb-3">
                            <Form.Label>Title</Form.Label>
                            <Form.Control type="text" name="title" value={newEvent.title} onChange={handleInputChange} required />
                        </Form.Group>
                        {/* Type */}
                        <Form.Group className="mb-3">
                            <Form.Label>Type</Form.Label>
                            <Form.Select name="type" value={newEvent.type} onChange={handleInputChange}>
                                <option value="meal">Meal</option>
                                <option value="vet">Vet Appointment</option>
                                <option value="play">Play Time</option>
                                <option value="sleep">Sleep Time</option>
                                <option value="medication">Medication</option>
                            </Form.Select>
                        </Form.Group>
                        {/* Start Date/Time */}
                        <Form.Group className="mb-3">
                            <Form.Label>Start Date & Time</Form.Label>
                            <Form.Control type="datetime-local" name="start" value={newEvent.start.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'start')} required />
                        </Form.Group>
                        {/* End Date/Time */}
                        <Form.Group className="mb-3">
                            <Form.Label>End Date & Time</Form.Label>
                            <Form.Control type="datetime-local" name="end" value={newEvent.end.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'end')} required />
                            <Form.Text muted>
                                For repeating events, the date part defines the range, and the time part defines the daily duration.
                            </Form.Text>
                        </Form.Group>
                        {/* Repeat Checkbox */}
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                name="repeat"
                                label="Repeat this event within the date range"
                                checked={newEvent.repeat}
                                onChange={handleRepeatChange}
                            />
                        </Form.Group>
                        {/* Conditional Repeat Options */}
                        {newEvent.repeat && (
                            <>
                                {/* Repeat Type */}
                                <Form.Group className="mb-3">
                                    <Form.Label>Repeat Type</Form.Label>
                                    <Form.Select name="repeatType" value={newEvent.repeatType} onChange={handleRepeatChange}>
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
                    {/* Delete button removed from here, handled by calendar click or list button */}
                    <Button variant="secondary" onClick={handleAddEditModalClose}>Close</Button>
                    <Button variant="primary" onClick={editEventRule ? handleEditEvent : handleAddEvent}>
                        {editEventRule ? 'Save Rule Changes' : 'Add Event Rule'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* --- NEW Delete Confirmation Modal --- */}
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
                <Modal.Footer className="justify-content-between"> {/* Adjust layout */}
                    <div> {/* Group occurrence/series delete buttons */}
                        {selectedOccurrence && editEventRule?.repeat && ( // Only show "This Occurrence" if it's a repeating event occurrence
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
            {/* --- End NEW Delete Confirmation Modal --- */}

        </Container>
    );
}

export default Scheduler;

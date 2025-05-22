import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment'; // For date and time manipulation.
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Styles for the calendar component.
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Alert from 'react-bootstrap/Alert';
import styles from './Scheduler.module.css'; // Component-specific styles.
import axios from 'axios'; // For making HTTP requests to the backend.

// Helper function to calculate the data fetching window around a center date.
const calculateDataWindow = (centerDate) => {
    const daysBuffer = 45; // Fetch data for +/- 45 days.
    return {
        start: moment(centerDate).subtract(daysBuffer, 'days').startOf('day').toDate(),
        end: moment(centerDate).add(daysBuffer, 'days').endOf('day').toDate(),
    };
};

// Initializes the localizer for react-big-calendar using moment.
const localizer = momentLocalizer(moment);

// Generates individual event occurrences from a schedule rule within a given window, handling exceptions.
const generateOccurrences = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    // Basic validation for the rule object.
    if (!rule || !rule.start || !rule.end || !rule._id) {
        return occurrences;
    }

    // Prepare exception dates for quick lookup (timestamps for reliable comparison).
    const exceptionTimestamps = new Set(
        (rule.exceptionDates || []).map(date => moment(date).valueOf())
    );

    // Convert rule's start/end dates and times to moment objects for easier manipulation.
    const ruleStartDate = moment(rule.start).startOf('day');
    const ruleEndDate = moment(rule.end).startOf('day');
    const ruleStartTime = moment(rule.start);
    const ruleEndTime = moment(rule.end);

    // Validate rule dates and times.
    if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) {
        return occurrences;
    }
    if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
         return occurrences;
    }

    // Calculate the duration of a single event occurrence, handling overnight events.
    const tempStart = moment().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
    const tempEnd = moment().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
    if (tempEnd.isSameOrBefore(tempStart)) { tempEnd.add(1, 'day'); }
    const dailyDuration = moment.duration(tempEnd.diff(tempStart));

    // Determine the iteration start and end dates based on the rule and window.
    let current = ruleStartDate.clone();
    if (current.isBefore(windowStart)) { current = windowStart.clone().startOf('day'); }
    const loopEndDate = moment.min(windowEnd, ruleEndDate);

    // Loop through each day in the relevant range to generate occurrences.
    while (current.isSameOrBefore(loopEndDate)) {
        let occursOnThisDay = false;
        // Check if the event occurs on the current day based on repetition rules.
        if (rule.repeat) {
            if (rule.repeatType === 'daily') {
                occursOnThisDay = true;
            } else if (rule.repeatType === 'weekly' && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(current.format('dddd'))) {
                occursOnThisDay = true;
            }
        } else { // For non-repeating events.
            if (current.isSame(ruleStartDate, 'day')) {
                occursOnThisDay = true;
            }
        }

        if (occursOnThisDay) {
            // Calculate the specific start and end time for this day's occurrence.
            const occurrenceStart = current.clone().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second() });
            const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

            // Add the occurrence if it's not an exception.
            if (!exceptionTimestamps.has(occurrenceStart.valueOf())) {
                occurrences.push({
                    title: rule.title,
                    type: rule.type,
                    originalRuleId: rule._id, // Store the ID of the base rule.
                    start: occurrenceStart.toDate(),
                    end: occurrenceEnd.toDate(),
                    repeat: rule.repeat,
                    repeatType: rule.repeatType,
                    repeatDays: rule.repeatDays,
                });
            }
        }
        current.add(1, 'day'); // Move to the next day.
    }
    return occurrences;
};

// Scheduler component for managing and displaying pet schedules.
function Scheduler() {
    // Effect hook to set the document title.
    useEffect(() => {
        document.title = "MISHTIKA - Scheduler";
    }, []);

    // State for storing the base schedule rules fetched from the backend.
    const [eventRules, setEventRules] = useState([]);
    // State for storing the individual event occurrences generated for display on the calendar.
    const [displayEvents, setDisplayEvents] = useState([]);
    // State for the current date the calendar is focused on.
    const [calendarDate, setCalendarDate] = useState(new Date());
    // State for the current data fetching window (start and end dates).
    const [currentViewRange, setCurrentViewRange] = useState(calculateDataWindow(new Date()));
    // State for controlling the visibility of the Add/Edit event modal.
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    // State for controlling the visibility of the Delete confirmation modal.
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    // State for the specific calendar event (occurrence) that was clicked.
    const [selectedOccurrence, setSelectedOccurrence] = useState(null);
    // State for the schedule rule being edited or associated with a delete action.
    const [editEventRule, setEditEventRule] = useState(null);
    // State for the form data when adding or editing an event rule.
    const [newEvent, setNewEvent] = useState({
        title: '',
        start: moment().startOf('hour').add(1, 'hour'),
        end: moment().startOf('hour').add(2, 'hour'),
        type: 'meal',
        repeat: false,
        repeatType: 'daily',
        repeatDays: [],
    });
    // State for displaying errors within the Add/Edit modal.
    const [modalError, setModalError] = useState('');
    // State for displaying errors within the Delete confirmation modal.
    const [deleteError, setDeleteError] = useState('');

    // Constants for days of the week and retrieving user information.
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const token = localStorage.getItem('token');
    let owner = null; // Owner ID extracted from the token.
    try {
        if (token) {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            owner = decodedToken.id;
        }
    } catch (e) {
        console.error("Error decoding token:", e);
    }

    // Fetches the base event rules from the backend for the current user.
    const fetchEventRules = useCallback(async () => {
        if (!owner || !token) {
            setEventRules([]);
            return;
        }
        try {
            const response = await axios.get(`https://mishtika.duckdns.org/schedules/owner/${owner}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            setEventRules(response.data || []);
        } catch (error) {
            console.error('Error fetching event rules:', error);
            setEventRules([]);
        }
    }, [owner, token]);

    // Effect hook to fetch event rules on initial load or when owner/token changes.
    useEffect(() => {
        fetchEventRules();
    }, [fetchEventRules]);

    // Effect hook to regenerate displayable calendar events when rules or the view range change.
    useEffect(() => {
        const generated = [];
        const windowStartMoment = moment(currentViewRange.start);
        const windowEndMoment = moment(currentViewRange.end);

        eventRules.forEach(rule => {
            const occurrences = generateOccurrences(rule, windowStartMoment, windowEndMoment);
            generated.push(...occurrences);
        });
        setDisplayEvents(generated);
    }, [eventRules, currentViewRange]);

    // Closes the Add/Edit modal and resets its state.
    const handleAddEditModalClose = () => {
        setShowAddEditModal(false);
        setEditEventRule(null);
        setModalError('');
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

    // Shows the Add/Edit modal, populating it with data if editing an existing rule.
    const handleAddEditModalShow = (ruleToEdit = null) => {
        setModalError('');
        if (!ruleToEdit) { // Adding a new rule.
            setEditEventRule(null);
            setNewEvent({
                title: '',
                start: moment().startOf('hour').add(1, 'hour'),
                end: moment().startOf('hour').add(2, 'hour'),
                type: 'meal',
                repeat: false,
                repeatType: 'daily',
                repeatDays: [],
            });
        } else { // Editing an existing rule.
            setEditEventRule(ruleToEdit);
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

    // Closes the Delete confirmation modal and resets related state.
    const handleDeleteConfirmModalClose = () => {
        setShowDeleteConfirmModal(false);
        setSelectedOccurrence(null);
        setEditEventRule(null);
        setDeleteError('');
    };

    // Shows the Delete confirmation modal, setting context for deleting an occurrence or a series.
    const handleDeleteConfirmModalShow = (eventOrRule) => {
        setDeleteError('');
        const ruleId = eventOrRule.originalRuleId || eventOrRule._id;
        const rule = eventRules.find(r => r._id === ruleId);

        if (!rule) {
            setDeleteError("Cannot delete: Associated rule not found.");
            setShowDeleteConfirmModal(true);
            return;
        }
        setEditEventRule(rule); // Store the rule for delete action.

        if (eventOrRule.originalRuleId && eventOrRule.start) { // Clicked a specific calendar occurrence.
             setSelectedOccurrence(eventOrRule);
        } else { // Clicked delete on a rule from the list.
             setSelectedOccurrence(null);
        }
        setShowDeleteConfirmModal(true);
    };

    // Handles input changes in the Add/Edit modal form.
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({ ...prev, [name]: value }));
    };

    // Handles date/time input changes in the Add/Edit modal form.
    const handleDateChange = (e, field) => {
        const { value } = e.target;
        setNewEvent(prev => ({ ...prev, [field]: moment(value) }));
    };

    // Handles changes to repeat options (checkbox, type, days) in the Add/Edit modal.
    const handleRepeatChange = (e) => {
        const { name, value, checked } = e.target;
        if (name === 'repeat') {
            setNewEvent(prev => ({
                ...prev,
                repeat: checked,
                repeatType: checked ? prev.repeatType : 'daily',
                repeatDays: checked ? prev.repeatDays : []
            }));
        } else if (name === 'repeatType') {
            setNewEvent(prev => ({
                ...prev,
                repeatType: value,
                repeatDays: value === 'weekly' ? prev.repeatDays : []
            }));
        } else if (name === 'repeatDays') {
            const day = value;
            setNewEvent(prev => ({
                ...prev,
                repeatDays: checked ? [...prev.repeatDays, day] : prev.repeatDays.filter(d => d !== day)
            }));
        }
    };

    // Validates the event form data before submission.
    const validateEvent = () => {
        setModalError('');
        if (!newEvent.title.trim()) { setModalError('Title is required.'); return false; }
        if (!newEvent.start || !newEvent.start.isValid()) { setModalError('Valid start date and time are required.'); return false; }
        if (!newEvent.end || !newEvent.end.isValid()) { setModalError('Valid end date and time are required.'); return false; }

        if (newEvent.repeat) { // Validation for repeating events.
            const startTime = moment().set({ hour: newEvent.start.hour(), minute: newEvent.start.minute() });
            const endTime = moment().set({ hour: newEvent.end.hour(), minute: newEvent.end.minute() });
            if (endTime.isSameOrBefore(startTime)) {
                 if (!newEvent.end.isAfter(newEvent.start, 'day')) {
                     const tempS = moment().set({ hour: newEvent.start.hour(), minute: newEvent.start.minute() });
                     const tempE = moment().set({ hour: newEvent.end.hour(), minute: newEvent.end.minute() });
                     if (tempE.isSameOrBefore(tempS)) {
                         // This validation might be too strict for simple overnight time ranges if date part is not considered.
                     }
                 }
            }
            if (newEvent.end.isBefore(newEvent.start, 'day')) {
                 setModalError('For repeating events, the end date cannot be before the start date.');
                 return false;
            }
        } else { // Validation for non-repeating events.
            if (newEvent.end.isSameOrBefore(newEvent.start)) {
                setModalError('End date and time must be after start date and time.');
                return false;
            }
        }
        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            setModalError('Please select at least one day for weekly repeat.');
            return false;
        }
        return true;
    };

    // Handles adding a new event rule to the backend.
    const handleAddEvent = async () => {
        if (!validateEvent()) return;
        const payload = {
            title: newEvent.title.trim(),
            start: newEvent.start.toISOString(),
            end: newEvent.end.toISOString(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
            owner
        };
        try {
            await axios.post('https://mishtika.duckdns.org/schedules/add', payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules();
            handleAddEditModalClose();
        } catch (error) {
            setModalError(error.response?.data?.message || 'Failed to add event.');
        }
    };

    // Handles editing an existing event rule in the backend.
    const handleEditEvent = async () => {
        if (!validateEvent() || !editEventRule) {
             if (!editEventRule) setModalError("Cannot save, no event rule is being edited.");
             return;
        }
        const payload = {
            title: newEvent.title.trim(),
            start: newEvent.start.toISOString(),
            end: newEvent.end.toISOString(),
            type: newEvent.type,
            repeat: newEvent.repeat,
            ...(newEvent.repeat && { repeatType: newEvent.repeatType }),
            ...(newEvent.repeat && newEvent.repeatType === 'weekly' && { repeatDays: newEvent.repeatDays }),
        };
        if (!newEvent.repeat) {
            payload.repeatType = null;
            payload.repeatDays = [];
        } else if (newEvent.repeatType !== 'weekly') {
            payload.repeatDays = [];
        }
        try {
            await axios.put(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules();
            handleAddEditModalClose();
        } catch (error) {
            setModalError(error.response?.data?.message || 'Failed to update event.');
        }
    };

    // Handles deleting an entire event series (rule) from the backend.
    const handleDeleteSeries = async () => {
        if (!editEventRule || !editEventRule._id) {
            setDeleteError("Cannot delete series: No rule selected."); return;
        }
        setDeleteError('');
        try {
            await axios.delete(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules();
            handleDeleteConfirmModalClose();
        } catch (error) {
            setDeleteError(error.response?.data?.message || 'Failed to delete event series.');
        }
    };

    // Handles deleting a single occurrence of a repeating event by adding an exception.
    const handleDeleteOccurrence = async () => {
        if (!selectedOccurrence || !selectedOccurrence.originalRuleId || !selectedOccurrence.start) {
             setDeleteError("Cannot delete occurrence: Invalid event data selected."); return;
        }
        setDeleteError('');
        const ruleId = selectedOccurrence.originalRuleId;
        const occurrenceDate = selectedOccurrence.start;
        try {
            await axios.post(`https://mishtika.duckdns.org/schedules/${ruleId}/exception`,
                { occurrenceDate: moment(occurrenceDate).toISOString() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchEventRules();
            handleDeleteConfirmModalClose();
        } catch (error) {
             setDeleteError(error.response?.data?.message || 'Failed to delete this occurrence.');
        }
    };

    // Provides custom styling for calendar events based on their type.
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

    // Handles clicks on events within the calendar, showing the delete confirmation modal.
    const handleSelectEvent = (event) => {
        handleDeleteConfirmModalShow(event);
    };

    // Handles calendar navigation (e.g., changing month/week). Updates the data fetching window.
    const handleNavigate = (newDate, view) => {
        setCalendarDate(newDate);
        setCurrentViewRange(calculateDataWindow(newDate));
    };

    // Handles calendar view changes (e.g., month, week, day). Updates the data fetching window.
    const handleView = (view) => {
        setCurrentViewRange(calculateDataWindow(calendarDate));
    };

    // Renders the Scheduler UI, including the calendar, event rule list, and modals.
    return (
        <Container className={`${styles.schedulerContainer} mt-5`}>
            <h1 className={styles.schedulerTitle}>Scheduler</h1>
            <Button variant="primary" onClick={() => handleAddEditModalShow(null)} className={styles.addEventButton}>
                Add Event Rule
            </Button>
            {/* Calendar component for displaying events */}
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
                    date={calendarDate}
                    length={30} // Shows 30 days in Agenda view.
                />
            </div>

            {/* List of base event rules */}
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
                            <Button variant="primary" size="sm" onClick={() => handleAddEditModalShow(rule)}>Edit Rule</Button>
                            <Button variant="danger" size="sm" className="ms-2" onClick={() => handleDeleteConfirmModalShow(rule)}>Delete</Button>
                        </div>
                    </li>
                )) : <li>No event rules found. Add one using the button above.</li>}
            </ul>

            {/* Modal for adding or editing an event rule */}
            <Modal show={showAddEditModal} onHide={handleAddEditModalClose}>
                <Modal.Header closeButton>
                    <Modal.Title>{editEventRule ? 'Edit Event Rule' : 'Add New Event Rule'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {modalError && <Alert variant="danger">{modalError}</Alert>}
                    <Form>
                        <Form.Group className="mb-3" controlId="formEventTitle">
                            <Form.Label>Title</Form.Label>
                            <Form.Control type="text" name="title" id="formEventTitle" value={newEvent.title} onChange={handleInputChange} required />
                        </Form.Group>
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
                        <Form.Group className="mb-3" controlId="formEventStart">
                            <Form.Label>Start Date & Time</Form.Label>
                            <Form.Control type="datetime-local" name="start" id="formEventStart" value={newEvent.start.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'start')} required />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formEventEnd">
                            <Form.Label>End Date & Time</Form.Label>
                            <Form.Control type="datetime-local" name="end" id="formEventEnd" value={newEvent.end.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'end')} required />
                            <Form.Text muted>For repeating events, the date part defines the range, and the time part defines the daily duration.</Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formEventRepeat">
                            <Form.Check type="checkbox" name="repeat" id="formEventRepeat" label="Repeat this event within the date range" checked={newEvent.repeat} onChange={handleRepeatChange} />
                        </Form.Group>
                        {newEvent.repeat && (
                            <>
                                <Form.Group className="mb-3" controlId="formEventRepeatType">
                                    <Form.Label>Repeat Type</Form.Label>
                                    <Form.Select name="repeatType" id="formEventRepeatType" value={newEvent.repeatType} onChange={handleRepeatChange}>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Specific days of the week</option>
                                    </Form.Select>
                                </Form.Group>
                                {newEvent.repeatType === 'weekly' && (
                                    <Form.Group className="mb-3">
                                        <Form.Label>Days of the Week</Form.Label>
                                        <div>
                                            {daysOfWeek.map((day) => (
                                                <Form.Check key={day} inline type="checkbox" name="repeatDays" value={day} label={day} id={`formEventRepeatDay-${day}`} checked={newEvent.repeatDays.includes(day)} onChange={handleRepeatChange} />
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

            {/* Modal for confirming deletion of an event occurrence or series */}
            <Modal show={showDeleteConfirmModal} onHide={handleDeleteConfirmModalClose} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {deleteError && <Alert variant="danger">{deleteError}</Alert>}
                    {selectedOccurrence ? (
                        <>
                            <p>Choose delete option for the event:</p>
                            <p><strong>"{editEventRule?.title}"</strong> on <strong>{moment(selectedOccurrence.start).format('MMM Do YYYY, h:mm a')}</strong>?</p>
                        </>
                    ) : (
                        <p>Are you sure you want to delete the entire series for <strong>"{editEventRule?.title}"</strong>?</p>
                    )}
                </Modal.Body>
                <Modal.Footer className="justify-content-between">
                    <div>
                        {selectedOccurrence && editEventRule?.repeat && (
                            <Button variant="warning" onClick={handleDeleteOccurrence} className="me-2">
                                Delete Only This Occurrence
                            </Button>
                        )}
                        <Button variant="danger" onClick={handleDeleteSeries}>
                            Delete Entire Series
                        </Button>
                    </div>
                    <Button variant="secondary" onClick={handleDeleteConfirmModalClose}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default Scheduler;


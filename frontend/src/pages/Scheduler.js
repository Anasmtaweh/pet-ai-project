// src/pages/Scheduler.js
// --- FINAL VERSION: Alarm-Style Repeating Events ---
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Alert from 'react-bootstrap/Alert';
import styles from './Scheduler.module.css';
import axios from 'axios';

const localizer = momentLocalizer(moment);

// --- REVISED Helper Function for Alarm-Style Occurrences ---
const generateOccurrences = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    // --- Basic validation ---
    if (!rule || !rule.start || !rule.end || !rule._id) {
        console.warn("Skipping occurrence generation for invalid/incomplete rule:", rule);
        return occurrences;
    }

    const ruleStartDate = moment(rule.start).startOf('day'); // Date part of rule start
    const ruleEndDate = moment(rule.end).startOf('day');   // Date part of rule end
    const ruleStartTime = moment(rule.start);             // Full start for time info
    const ruleEndTime = moment(rule.end);               // Full end for time info

    // --- Validate dates ---
    if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) {
        console.warn(`Skipping rule "${rule.title}" (${rule._id}) due to invalid date range.`);
        return occurrences;
    }
    if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
         console.warn(`Skipping rule "${rule.title}" (${rule._id}) due to invalid time.`);
         return occurrences;
    }

    // --- Calculate the duration of ONE occurrence based on TIME ONLY ---
    // Create moments on the *same arbitrary day* to get time difference correctly
    const tempStart = moment().set({
        hour: ruleStartTime.hour(),
        minute: ruleStartTime.minute(),
        second: ruleStartTime.second(),
        millisecond: 0
    });
    const tempEnd = moment().set({
        hour: ruleEndTime.hour(),
        minute: ruleEndTime.minute(),
        second: ruleEndTime.second(),
        millisecond: 0
    });

    // Handle overnight duration (e.g., 10 PM to 2 AM)
    if (tempEnd.isSameOrBefore(tempStart)) {
        tempEnd.add(1, 'day'); // Assume it ends the next day if time is earlier/same
    }
    const dailyDuration = moment.duration(tempEnd.diff(tempStart));
    // --- End duration calculation ---

    // --- Determine loop start/end based on window and rule dates ---
    let current = ruleStartDate.clone(); // Start checking from the rule's start date
    // If rule starts before the window, start checking from the window start
    if (current.isBefore(windowStart)) {
        current = windowStart.clone().startOf('day');
    }

    const loopEndDate = moment.min(windowEnd, ruleEndDate); // Stop at whichever comes first: window end or rule end date
    // --- End loop boundary determination ---


    // console.log(`Generating for rule "${rule.title}" (${rule._id}). Range: ${ruleStartDate.format('YYYY-MM-DD')} to ${ruleEndDate.format('YYYY-MM-DD')}. Loop: ${current.format('YYYY-MM-DD')} to ${loopEndDate.format('YYYY-MM-DD')}`); // Optional log

    // --- Loop through relevant days ---
    while (current.isSameOrBefore(loopEndDate)) { // Loop respects rule end date
        let occursOnThisDay = false;

        // Check if the rule applies based on repeat settings
        if (rule.repeat) {
            if (rule.repeatType === 'daily') {
                occursOnThisDay = true;
            } else if (rule.repeatType === 'weekly') {
                const currentDayName = current.format('dddd');
                if (rule.repeatDays && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(currentDayName)) {
                    occursOnThisDay = true;
                }
            }
        } else {
            // Non-repeating event only occurs on the start date
            if (current.isSame(ruleStartDate, 'day')) {
                occursOnThisDay = true;
            }
        }


        if (occursOnThisDay) {
            // Create the specific occurrence for this day using the rule's START TIME
            const occurrenceStart = current.clone().set({
                hour: ruleStartTime.hour(),
                minute: ruleStartTime.minute(),
                second: ruleStartTime.second(),
            });
            // Calculate the end by adding the daily duration
            const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

            // Add the occurrence
            occurrences.push({
                title: rule.title,
                type: rule.type,
                originalRuleId: rule._id,
                start: occurrenceStart.toDate(),
                end: occurrenceEnd.toDate(),
            });
            // console.log(` -> Added occurrence: ${occurrenceStart.format()} to ${occurrenceEnd.format()}`); // Optional log
        }

        current.add(1, 'day'); // Move to the next day
    }

    return occurrences;
};
// --- End REVISED Helper Function ---


function Scheduler() {
    useEffect(() => {
        document.title = "MISHTIKA - Scheduler";
    }, []);

    const [eventRules, setEventRules] = useState([]); // Store original rules from backend
    const [displayEvents, setDisplayEvents] = useState([]); // Store events to show in calendar (occurrences + singles)
    const [showModal, setShowModal] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        start: moment().startOf('hour').add(1, 'hour'),
        end: moment().startOf('hour').add(2, 'hour'),
        type: 'meal',
        repeat: false,
        repeatType: 'daily',
        repeatDays: [],
    });
    const [editEventRule, setEditEventRule] = useState(null);
    const [modalError, setModalError] = useState('');
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const token = localStorage.getItem('token');
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const owner = decodedToken.id;

    // --- Fetch original event rules ---
    const fetchEventRules = useCallback(async () => {
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
        const windowStart = moment().subtract(1, 'year').startOf('day');
        const windowEnd = moment().add(1, 'year').endOf('day');

        eventRules.forEach(rule => {
            // Use the generateOccurrences function for BOTH repeating and non-repeating
            // as it now correctly handles the single occurrence case too.
            const occurrences = generateOccurrences(rule, windowStart, windowEnd);
            generated.push(...occurrences);

            // --- Old logic removed ---
            // if (rule.repeat) {
            //     const occurrences = generateOccurrences(rule, windowStart, windowEnd);
            //     generated.push(...occurrences);
            // } else {
            //      const singleStart = moment(rule.start);
            //      if (singleStart.isValid() && singleStart.isBetween(windowStart, windowEnd, undefined, '[]')) {
            //         generated.push({
            //             title: rule.title,
            //             type: rule.type,
            //             originalRuleId: rule._id,
            //             start: singleStart.toDate(),
            //             end: moment(rule.end).toDate(),
            //         });
            //      } else if (!singleStart.isValid()) {
            //          console.warn(`Skipping single event rule "${rule.title}" (${rule._id}) due to invalid start date.`);
            //      }
            // }
        });
        console.log("Generated display events:", generated);
        setDisplayEvents(generated);
    }, [eventRules]);

    // --- Modal Handling ---
    const handleClose = () => {
        setShowModal(false);
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

    const handleShow = (event) => {
        setModalError('');
        let originalRule = null;

        if (!event) {
            console.log("Opening modal to add new rule.");
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
        } else {
            const ruleId = event.originalRuleId || event._id;
            console.log(`Opening modal to edit rule for event/rule ID: ${ruleId}`);
            originalRule = eventRules.find(rule => rule._id === ruleId);

            if (!originalRule) {
                console.error("Could not find original rule for event:", event);
                setModalError("Could not load event details. The original rule might have been deleted. Please refresh.");
                return;
            }

            console.log("Found original rule to edit:", originalRule);
            setEditEventRule(originalRule);
            setNewEvent({
                title: originalRule.title || '',
                start: originalRule.start ? moment(originalRule.start) : moment(),
                end: originalRule.end ? moment(originalRule.end) : moment(),
                type: originalRule.type || 'meal',
                repeat: originalRule.repeat || false,
                repeatType: originalRule.repeatType || 'daily',
                repeatDays: Array.isArray(originalRule.repeatDays) ? originalRule.repeatDays : [],
            });
        }
        setShowModal(true);
    };

    // --- Input change handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e, field) => {
        const value = e.target.value;
        setNewEvent(prev => ({ ...prev, [field]: moment(value) }));
    };

    const handleRepeatChange = (e) => {
        const { name, value, checked } = e.target;
        if (name === 'repeat') {
            setNewEvent(prev => ({ ...prev, repeat: checked, repeatDays: checked ? prev.repeatDays : [] }));
        } else if (name === 'repeatType') {
            setNewEvent(prev => ({ ...prev, repeatType: value, repeatDays: [] }));
        } else if (name === 'repeatDays') {
            const day = value;
            if (checked) {
                setNewEvent(prev => ({ ...prev, repeatDays: [...new Set([...prev.repeatDays, day])] }));
            } else {
                setNewEvent(prev => ({ ...prev, repeatDays: prev.repeatDays.filter(d => d !== day) }));
            }
        }
    };

    // --- Validation Function (Duration check removed) ---
    const validateEvent = () => {
        setModalError('');
        if (!newEvent.title.trim()) {
            setModalError('Title is required.'); return false;
        }
        if (!newEvent.start || !newEvent.start.isValid()) {
            setModalError('Invalid start date/time.'); return false;
        }
        if (!newEvent.end || !newEvent.end.isValid()) {
            setModalError('Invalid end date/time.'); return false;
        }
        // Check if rule end DATE is before rule start DATE
        if (newEvent.end.clone().startOf('day').isBefore(newEvent.start.clone().startOf('day'))) {
             setModalError('End Date cannot be before Start Date.'); return false;
        }
        // Check if rule end TIME is same or before start TIME on the SAME day (allow overnight)
        // This check might be too strict depending on how you want to handle exact same start/end time
        // if (newEvent.end.isSameOrBefore(newEvent.start)) {
        //     setModalError('End Date/Time must be after Start Date/Time.'); return false;
        // }

        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            setModalError('Please select at least one day for weekly repetition.'); return false;
        }
        return true; // Validation passed
    };
    // --- End Validation Function ---


    // --- CRUD Operations (operate on RULES) ---
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
            fetchEventRules();
            handleClose();
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
        if (!newEvent.repeat) {
            payload.repeatType = undefined;
            payload.repeatDays = [];
        } else if (newEvent.repeatType !== 'weekly') {
            payload.repeatDays = [];
        }
        console.log("Updating schedule rule:", editEventRule._id, payload);
        try {
            await axios.put(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules();
            handleClose();
        } catch (error) {
            console.error('Error updating event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to update event.');
        }
    };

    const handleDeleteEvent = async () => {
        if (!editEventRule || !editEventRule._id) {
            console.error("Cannot delete event rule: No rule selected in modal.");
            setModalError("Cannot delete: No rule selected.");
            return;
        }
        console.log("Deleting schedule rule:", editEventRule._id);
        try {
            await axios.delete(`https://mishtika.duckdns.org/schedules/${editEventRule._id}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            fetchEventRules();
            handleClose();
        } catch (error) {
            console.error('Error deleting event rule:', error);
            setModalError(error.response?.data?.message || 'Failed to delete event.');
        }
    };

    // --- eventPropGetter ---
    const eventPropGetter = (event) => {
        let styleChanges = {
            backgroundColor: "#A0522D", // Default: meal
            color: 'white',
            borderRadius: "0px",
            border: "none",
        };
        const eventType = event.type || 'meal';
        switch (eventType) {
            case 'vet': styleChanges.backgroundColor = "#8FBC8F"; break;
            case 'sleep': styleChanges.backgroundColor = "#17a2b8"; break;
            case 'medication': styleChanges.backgroundColor = "#ffc107"; break;
            case 'play': styleChanges.backgroundColor = "#dc3545"; break;
            default: break;
        }
        return { style: styleChanges };
    };

    // --- handleSelectEvent ---
    const handleSelectEvent = (event) => {
        console.log("Event selected on calendar:", event);
        handleShow(event);
    };


    // --- Render ---
    return (
        <Container className={`${styles.schedulerContainer} mt-5`}>
            <h1 className={styles.schedulerTitle}>Scheduler</h1>
            <Button variant="primary" onClick={() => handleShow(null)} className={styles.addEventButton}>
                Add Event Rule
            </Button>
            <div className={styles.calendarContainer}>
                <Calendar
                    localizer={localizer}
                    events={displayEvents} // USE THE GENERATED OCCURRENCES
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    onSelectEvent={handleSelectEvent}
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
                            <Button variant="primary" size="sm" onClick={() => handleShow(rule)}>Edit Rule</Button>
                        </div>
                    </li>
                )) : <li>No event rules found. Add one using the button above.</li>}
            </ul>

            {/* --- Modal --- */}
            <Modal show={showModal} onHide={handleClose}>
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
                    {editEventRule && (
                        <Button variant="danger" onClick={handleDeleteEvent}>
                            Delete Rule
                        </Button>
                    )}
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={editEventRule ? handleEditEvent : handleAddEvent}>
                        {editEventRule ? 'Save Rule Changes' : 'Add Event Rule'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default Scheduler;

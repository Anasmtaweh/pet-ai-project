// src/pages/Scheduler.js
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Alert from 'react-bootstrap/Alert'; // Import Alert
import styles from './Scheduler.module.css';
import axios from 'axios';

const localizer = momentLocalizer(moment);

function Scheduler() {
    useEffect(() => {
        document.title = "MISHTIKA - Scheduler";
    }, []);
    const [events, setEvents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        start: moment(),
        end: moment(),
        type: 'meal',
        repeat: false,
        repeatType: 'daily',
        repeatDays: [],
    });
    const [editEvent, setEditEvent] = useState(null);
    const [modalError, setModalError] = useState(''); // State for modal validation errors
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const token = localStorage.getItem('token');
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const owner = decodedToken.id;

    // --- useEffect for fetching events remains the same ---
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await axios.get(`https://mishtika.duckdns.org/schedules/owner/${owner}`);
                const fetchedEvents = response.data;
                const generatedEvents = [];

                fetchedEvents.forEach(event => {
                    const start = moment(event.start);
                    const end = moment(event.end);
                    if (event.repeat) {
                        // Generate occurrences for display (keep this logic or adapt based on backend needs)
                        // For simplicity, let's just add the base event rule for now
                        // You might need more sophisticated logic here depending on how you want to display repeats
                        generatedEvents.push({
                            ...event,
                            start: start.toDate(),
                            end: end.toDate(),
                        });
                    } else {
                        generatedEvents.push({
                            ...event,
                            start: start.toDate(),
                            end: end.toDate(),
                        });
                    }
                });
                setEvents(generatedEvents); // Displaying base events or generated ones
            } catch (error) {
                console.error('Error fetching events:', error);
            }
        };

        fetchEvents();
    }, [owner]); // Removed daysOfWeek dependency if not strictly needed for fetch


    const handleClose = () => {
        setShowModal(false);
        setEditEvent(null);
        setModalError(''); // Clear modal error on close
        setNewEvent({
            title: '',
            start: moment(),
            end: moment(),
            type: 'meal',
            repeat: false,
            repeatType: 'daily',
            repeatDays: [],
        });
    };

    const handleShow = (event) => {
        setModalError(''); // Clear modal error on show
        if (event) {
            // Find the original event rule if it's a generated occurrence
            const originalEvent = events.find(e => e._id === event._id) || event;
            setEditEvent(originalEvent);
            setNewEvent({
                title: originalEvent.title || '',
                start: originalEvent.start ? moment(originalEvent.start) : moment(),
                end: originalEvent.end ? moment(originalEvent.end) : moment(),
                type: originalEvent.type || 'meal',
                repeat: originalEvent.repeat || false,
                repeatType: originalEvent.repeatType || 'daily',
                repeatDays: originalEvent.repeatDays || [],
            });
        } else {
            setNewEvent({
                title: '',
                start: moment(),
                end: moment(),
                type: 'meal',
                repeat: false,
                repeatType: 'daily',
                repeatDays: [],
            });
            setEditEvent(null);
        }
        setShowModal(true);
    };

    // --- Input change handlers remain the same ---
    const handleInputChange = (e) => {
        setNewEvent({ ...newEvent, [e.target.name]: e.target.value });
    };

    const handleDateChange = (e, field) => {
        setNewEvent({ ...newEvent, [field]: moment(e.target.value) });
    };

    const handleRepeatChange = (e) => {
        if (e.target.name === 'repeat') {
            setNewEvent({ ...newEvent, [e.target.name]: e.target.checked, repeatDays: [] });
        } else if (e.target.name === 'repeatType') {
            setNewEvent({ ...newEvent, [e.target.name]: e.target.value, repeatDays: [] });
        } else {
            const day = e.target.value;
            if (e.target.checked) {
                setNewEvent({ ...newEvent, repeatDays: [...newEvent.repeatDays, day] });
            } else {
                setNewEvent({ ...newEvent, repeatDays: newEvent.repeatDays.filter(d => d !== day) });
            }
        }
    };


    // --- Validation Function ---
    const validateEvent = () => {
        if (!newEvent.title.trim()) {
            setModalError('Title is required.');
            return false;
        }
        if (!newEvent.start || !newEvent.start.isValid()) {
            setModalError('Invalid start date/time.');
            return false;
        }
        if (!newEvent.end || !newEvent.end.isValid()) {
            setModalError('Invalid end date/time.');
            return false;
        }
        if (newEvent.end.isBefore(newEvent.start)) {
            setModalError('End time must be after start time.');
            return false;
        }
        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            setModalError('Please select at least one day for weekly repetition.');
            return false;
        }
        // Add any other specific validation rules here

        setModalError(''); // Clear error if validation passes
        return true;
    };

    const handleAddEvent = async () => {
        if (!validateEvent()) { // Call validation function
            return;
        }

        const payload = {
            ...newEvent,
            start: newEvent.start.toDate(), // Convert moment to Date
            end: newEvent.end.toDate(),     // Convert moment to Date
            owner
        };
        console.log("Sending schedule data:", payload);

        try {
            const response = await axios.post('https://mishtika.duckdns.org/schedules/add', payload);
            // Add the new event rule to the state
            setEvents(prevEvents => [...prevEvents, { ...response.data, start: new Date(response.data.start), end: new Date(response.data.end) }]);
            handleClose();
        } catch (error) {
            console.error('Error adding event:', error);
            // Display backend error in modal if available, otherwise generic
            setModalError(error.response?.data?.message || 'Failed to add event. Please try again.');
        }
    };

    const handleEditEvent = async () => {
        if (!validateEvent()) { // Call validation function
            return;
        }

        const payload = {
            ...newEvent,
            start: newEvent.start.toDate(), // Convert moment to Date
            end: newEvent.end.toDate()      // Convert moment to Date
            // Owner is not needed for update usually, backend uses ID from URL
        };
        console.log("Updating schedule data:", payload);

        try {
            const response = await axios.put(`https://mishtika.duckdns.org/schedules/${editEvent._id}`, payload);
            // Update the event rule in the state
            setEvents(prevEvents => prevEvents.map(event =>
                event._id === editEvent._id
                    ? { ...response.data, start: new Date(response.data.start), end: new Date(response.data.end) }
                    : event
            ));
            handleClose();
        } catch (error) {
            console.error('Error updating event:', error);
            // Display backend error in modal if available, otherwise generic
            setModalError(error.response?.data?.message || 'Failed to update event. Please try again.');
        }
    };

    const handleDeleteEvent = async (eventToDelete) => {
        // Use the _id from the event object passed to the function
        if (!eventToDelete || !eventToDelete._id) {
            console.error("Cannot delete event without ID");
            return;
        }
        try {
            await axios.delete(`https://mishtika.duckdns.org/schedules/${eventToDelete._id}`);
            setEvents(events.filter(e => e._id !== eventToDelete._id));
            handleClose(); // Close modal if the deleted event was being edited
        } catch (error) {
            console.error('Error deleting event:', error);
            // Optionally set an error message for the main page, not the modal
        }
    };

    // --- eventPropGetter and handleSelectEvent remain the same ---
    const eventPropGetter = (event) => {
        let newStyle = {
            backgroundColor: "#A0522D", // Default: meal
            color: 'white',
            borderRadius: "0px",
            border: "none"
        };

        switch (event.type) {
            case 'vet':
                newStyle.backgroundColor = "#8FBC8F"; // Greenish
                break;
            case 'sleep':
                newStyle.backgroundColor = "#17a2b8"; // Teal
                break;
            case 'medication':
                newStyle.backgroundColor = "#ffc107"; // Yellow
                break;
            case 'play':
                newStyle.backgroundColor = "#dc3545"; // Red
                break;
            default:
                break; // Keep default for 'meal' or others
        }

        return {
            className: "",
            style: newStyle
        };
    };
    const handleSelectEvent = (event) => {
        handleShow(event);
    };


    return (
        <Container className={`${styles.schedulerContainer} mt-5`}>
            <h1 className={styles.schedulerTitle}>Scheduler</h1>
            <Button variant="primary" onClick={() => handleShow(null)} className={styles.addEventButton}>
                Add Event
            </Button>
            <div className={styles.calendarContainer}>
                <Calendar
                    localizer={localizer}
                    // Decide how to display events: generated occurrences or just base rules?
                    // Using 'events' state which might contain generated ones or just rules based on fetch logic
                    events={events.map(ev => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))} // Ensure dates are Date objects
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventPropGetter}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    defaultView={Views.MONTH}
                />
            </div>

            {/* Event List can show the base rules */}
            <h2 className={styles.eventListTitle}>Events List (Rules)</h2>
            <ul className={styles.eventList}>
                {events.filter(e => e._id) // Filter out potentially generated events without _id if necessary
                    .map((event) => (
                    <li key={event._id} className={styles.eventListItem}>
                        <strong className={styles.eventTitle}>{event.title}</strong> - {event.type}
                        {event.repeat && ` (Repeats ${event.repeatType})`}
                        <br />
                        <span className={styles.eventTime}>
                            Base Start: {moment(event.start).format('MMM Do YYYY, h:mm a')} <br/>
                            Base End: {moment(event.end).format('MMM Do YYYY, h:mm a')}
                        </span>
                        <div className={styles.eventButtons}>
                            <Button variant="primary" size="sm" onClick={() => handleShow(event)}>Edit</Button>
                            <Button variant="danger" size="sm" onClick={() => handleDeleteEvent(event)}>Delete</Button>
                        </div>
                    </li>
                ))}
            </ul>

            <Modal show={showModal} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>{editEvent ? 'Edit Event' : 'Add New Event'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Display Modal Error Here */}
                    {modalError && <Alert variant="danger">{modalError}</Alert>}
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Title</Form.Label>
                            <Form.Control type="text" name="title" value={newEvent.title} onChange={handleInputChange} required />
                        </Form.Group>
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
                        <Form.Group className="mb-3">
                            <Form.Label>Start Time</Form.Label>
                            <Form.Control type="datetime-local" name="start" value={newEvent.start.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'start')} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>End Time</Form.Label>
                            <Form.Control type="datetime-local" name="end" value={newEvent.end.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'end')} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                name="repeat"
                                label="Repeat"
                                checked={newEvent.repeat}
                                onChange={handleRepeatChange}
                            />
                        </Form.Group>
                        {newEvent.repeat && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Repeat Type</Form.Label>
                                    <Form.Select name="repeatType" value={newEvent.repeatType} onChange={handleRepeatChange}>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Specific days of the week</option>
                                    </Form.Select>
                                </Form.Group>

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
                    {editEvent && (
                        <Button variant="danger" onClick={() => handleDeleteEvent(editEvent)}>
                            Delete Event
                        </Button>
                    )}
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={editEvent ? handleEditEvent : handleAddEvent}>
                        {editEvent ? 'Save Changes' : 'Add Event'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default Scheduler;


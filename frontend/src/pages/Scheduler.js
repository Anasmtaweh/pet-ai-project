import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './Scheduler.module.css'; // Import the CSS Module
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
        start: moment(), // Initialize with moment objects
        end: moment(), // Initialize with moment objects
        type: 'meal',
        repeat: false,
        repeatType: 'daily',
        repeatDays: [],
    });
    const [editEvent, setEditEvent] = useState(null);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const token = localStorage.getItem('token');
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const owner = decodedToken.id; // Extract user ID from the token

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/schedules/owner/${owner}`);
                const fetchedEvents = response.data;
                const generatedEvents = [];

                fetchedEvents.forEach(event => {
                    const start = moment(event.start);
                    const end = moment(event.end);
                    if (event.repeat) {
                        if (event.repeatType === 'daily') {
                            let currentDate = start.clone();
                            while (currentDate.isSameOrBefore(end, 'day')) {
                                const newStart = currentDate.clone().hour(start.hour()).minute(start.minute()).second(start.second());
                                const newEnd = currentDate.clone().hour(end.hour()).minute(end.minute()).second(end.second());
                                generatedEvents.push({
                                    ...event,
                                    start: newStart.toDate(),
                                    end: newEnd.toDate(),
                                });
                                currentDate.add(1, 'day');
                            }
                        } else if (event.repeatType === 'weekly') {
                            event.repeatDays.forEach(day => {
                                const dayIndex = daysOfWeek.indexOf(day);
                                let currentDate = start.clone().day(dayIndex);
                                if (currentDate.isBefore(start)) {
                                    currentDate.add(7, 'day');
                                }
                                while (currentDate.isSameOrBefore(end, 'day')) {
                                    const newStart = currentDate.clone().hour(start.hour()).minute(start.minute()).second(start.second());
                                    const newEnd = currentDate.clone().hour(end.hour()).minute(end.minute()).second(end.second());
                                    generatedEvents.push({
                                        ...event,
                                        start: newStart.toDate(),
                                        end: newEnd.toDate(),
                                    });
                                    currentDate.add(7, 'day');
                                }
                            });
                        }
                    } else {
                        generatedEvents.push({
                            ...event,
                            start: start.toDate(),
                            end: end.toDate(),
                        });
                    }
                });
                setEvents(generatedEvents);
            } catch (error) {
                console.error('Error fetching events:', error);
            }
        };

        fetchEvents();
    }, [owner, daysOfWeek]);

    const handleClose = () => {
        setShowModal(false);
        setEditEvent(null);
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
        if (event) {
            setEditEvent(event);
            setNewEvent({
                title: event.title || '',
                start: event.start ? moment(event.start) : moment(), // Use moment objects
                end: event.end ? moment(event.end) : moment(), // Use moment objects
                type: event.type || 'meal',
                repeat: event.repeat || false,
                repeatType: event.repeatType || 'daily',
                repeatDays: event.repeatDays || [],
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

    const handleInputChange = (e) => {
        setNewEvent({ ...newEvent, [e.target.name]: e.target.value });
    };

    const handleDateChange = (e, field) => {
        setNewEvent({ ...newEvent, [field]: moment(e.target.value) }); // Use moment objects
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

    const handleAddEvent = async () => {
        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            alert('Please select at least one day of the week for weekly repetition.');
            return;
        }
        try {
            const response = await axios.post('http://localhost:3001/schedules/add', { ...newEvent, start: newEvent.start.toDate(), end: newEvent.end.toDate(), owner });
            setEvents(prevEvents => [...prevEvents, { ...response.data, start: new Date(response.data.start), end: new Date(response.data.end) }]);
            handleClose();
        } catch (error) {
            console.error('Error adding event:', error);
        }
    };

    const handleEditEvent = async () => {
        if (newEvent.repeat && newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
            alert('Please select at least one day of the week for weekly repetition.');
            return;
        }
        try {
            const response = await axios.put(`http://localhost:3001/schedules/${editEvent._id}`, { ...newEvent, start: newEvent.start.toDate(), end: newEvent.end.toDate() });
            setEvents(prevEvents => prevEvents.map(event => event._id === editEvent._id ? { ...response.data, start: new Date(response.data.start), end: new Date(response.data.end) } : event));
            handleClose();
        } catch (error) {
            console.error('Error updating event:', error);
        }
    };

    const handleDeleteEvent = async (event) => {
        try {
            await axios.delete(`http://localhost:3001/schedules/${event._id}`);
            setEvents(events.filter(e => e._id !== event._id));
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };
    const eventPropGetter = (event) => {
        let newStyle = {
            backgroundColor: "#A0522D",
            color: 'white',
            borderRadius: "0px",
            border: "none"
        };

        if (event.type === 'vet') {
            newStyle.backgroundColor = "#8FBC8F";
        } else if (event.type === 'sleep') {
            newStyle.backgroundColor = "#17a2b8";
        } else if (event.type === 'medication') {
            newStyle.backgroundColor = "#ffc107";
        } else if (event.type === 'play') {
            newStyle.backgroundColor = "#dc3545";
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
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventPropGetter}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    defaultView={Views.MONTH}
                />
            </div>
            <h2 className={styles.eventListTitle}>Events List</h2>
            <ul className={styles.eventList}>
                {events.map((event, index) => (
                    <li key={index} className={styles.eventListItem}>
                        <strong className={styles.eventTitle}>{event.title}</strong> - {event.type}<br />
                        <span className={styles.eventTime}>
                            {moment(event.start).format('MMM Do YYYY, h:mm a')} - {moment(event.end).format('MMM Do YYYY, h:mm a')}
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
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Title</Form.Label>
                            <Form.Control type="text" name="title" value={newEvent.title} onChange={handleInputChange} />
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
                            <Form.Control type="datetime-local" name="start" value={newEvent.start.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'start')} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>End Time</Form.Label>
                            <Form.Control type="datetime-local" name="end" value={newEvent.end.format('YYYY-MM-DDTHH:mm')} onChange={(e) => handleDateChange(e, 'end')} />
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

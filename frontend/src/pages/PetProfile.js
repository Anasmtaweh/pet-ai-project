import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import ListGroup from 'react-bootstrap/ListGroup';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Link } from 'react-router-dom';
import styles from './PetProfile.module.css';
import { FaCat, FaDog, FaWeight, FaCalendarAlt, FaVenus, FaMars, FaPlus } from 'react-icons/fa'; // Added FaPlus

function PetProfile() {
    useEffect(() => {
        document.title = "MISHTIKA - Pet Profile";
    }, []);
    const [pets, setPets] = useState([]);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    const fetchPets = async () => { // Moved fetch logic into its own function
        setError(''); // Clear previous errors
        if (!token) {
            setError("Not logged in.");
            return;
        }
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const ownerId = decodedToken.id;
            const response = await axios.get(`https://mishtika.duckdns.org/pets/owner/${ownerId}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            setPets(response.data);
        } catch (error) {
            console.error('Error fetching pets:', error);
            if (error.response?.status === 404) {
                setPets([]); // Set empty array if no pets found
            } else {
                setError(error.response?.data?.message || 'Failed to fetch pets.');
            }
        }
    };

    useEffect(() => {
        fetchPets();
    }, [token]); // Fetch on initial load or token change

    const handleDelete = async (petId) => {
        // Optional: Add confirmation dialog here
        if (!window.confirm(`Are you sure you want to delete this pet?`)) {
            return;
        }
        setError('');
        try {
            await axios.delete(`https://mishtika.duckdns.org/pets/${petId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Re-fetch pets after deletion to update the list
            fetchPets();
            // Or filter locally: setPets(pets.filter((pet) => pet._id !== petId));
        } catch (error) {
            console.error('Error deleting pet:', error);
            setError(error.response?.data?.message || 'Failed to delete pet.');
        }
    };

    return (
        <Container className={`${styles.petProfileContainer} mt-5`}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                 <h1 className={styles.petProfileTitle}>Your Pets</h1>
                 <Link to="/petform">
                     <Button variant="success">
                         <FaPlus className="me-2" /> Add Pet
                     </Button>
                 </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {pets.length === 0 && !error && <p>You haven't added any pets yet. Click "Add Pet" to get started!</p>}

            <ListGroup>
                {pets.map((pet) => (
                    <ListGroup.Item key={pet._id} className={styles.petItem}>
                        <Row className="align-items-center">
                            <Col xs={12} md={4} className="text-center mb-3 mb-md-0">
                                {pet.pictures && pet.pictures.length > 0 ? (
                                    <div className={styles.imageContainer}>
                                        <img
                                            // Assuming pictures are URLs, otherwise adjust src
                                            src={pet.pictures[0]}
                                            alt={`${pet.name}`}
                                            className={styles.petImage}
                                            onError={(e) => { e.target.style.display = 'none'; /* Hide broken img */ }}
                                        />
                                        {/* Placeholder if image fails or no image */}
                                        {/* Consider adding a default image */}
                                    </div>
                                ) : (
                                     <div className={styles.imagePlaceholder}>
                                         {pet.species === 'Cat' ? <FaCat size={80} /> : <FaDog size={80} />}
                                     </div>
                                )}
                            </Col>
                            <Col xs={12} md={5}>
                                <div className={styles.petInfoContainer}>
                                    <strong className={styles.petName}>{pet.name}</strong>
                                    {/* Species */}
                                    <div className={styles.speciesInfo}>
                                        {pet.species === 'Cat' ? <FaCat className={styles.speciesIcon} aria-hidden="true" /> : <FaDog className={styles.speciesIcon} aria-hidden="true" />}
                                        <span className={styles.speciesName}>{pet.species} ({pet.breed})</span>
                                    </div>
                                    {/* Gender Display */}
                                    <div className={styles.petInfo}>
                                        {pet.gender === 'Male' ? <FaMars className={styles.infoIcon} aria-hidden="true" /> : <FaVenus className={styles.infoIcon} aria-hidden="true" />}
                                        <span>{pet.gender}</span>
                                    </div>
                                    {/* Weight */}
                                    <div className={styles.petInfo}>
                                        <FaWeight className={styles.infoIcon} aria-hidden="true" />
                                        <span>{pet.weight} kg</span>
                                    </div>
                                    {/* Age */}
                                    <div className={styles.petInfo}>
                                        <FaCalendarAlt className={styles.infoIcon} aria-hidden="true" />
                                        <span>{pet.ageYears} years, {pet.ageMonths} months</span>
                                    </div>
                                    {/* Medical Info */}
                                    {pet.medicalInfo && (
                                        <div className={styles.petInfo}>
                                            <strong>Medical Info:</strong> {pet.medicalInfo}
                                        </div>
                                    )}
                                </div>
                            </Col>
                            <Col xs={12} md={3} className="d-flex flex-column justify-content-center align-items-center mt-3 mt-md-0">
                                <Link to={`/editpet/${pet._id}`} className="w-100 mb-2">
                                    <Button variant="primary" className={`${styles.editButton} w-100`}>
                                        Edit
                                    </Button>
                                </Link>
                                <Button variant="danger" className={`${styles.deleteButton} w-100`} onClick={() => handleDelete(pet._id)}>
                                    Delete
                                </Button>
                            </Col>
                        </Row>
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </Container>
    );
}

export default PetProfile;

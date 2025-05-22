import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import ListGroup from 'react-bootstrap/ListGroup';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Link } from 'react-router-dom';
import styles from './PetProfile.module.css';
// Importing icons for UI elements.
import { FaCat, FaDog, FaWeight, FaCalendarAlt, FaVenus, FaMars, FaPlus } from 'react-icons/fa';

// PetProfile component to display and manage a user's pets.
function PetProfile() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Pet Profile";
    }, []);

    // State for storing the list of pets.
    const [pets, setPets] = useState([]);
    // State for storing error messages.
    const [error, setError] = useState('');
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Function to fetch the current user's pets from the backend.
    const fetchPets = async () => {
        setError(''); // Clear previous errors.
        if (!token) {
            setError("Not logged in.");
            return;
        }
        try {
            // Decode token to get owner ID.
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const ownerId = decodedToken.id;
            // API call to get pets by owner ID.
            const response = await axios.get(`https://mishtika.duckdns.org/pets/owner/${ownerId}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            setPets(response.data); // Update state with fetched pets.
        } catch (error) {
            console.error('Error fetching pets:', error);
            if (error.response?.status === 404) {
                setPets([]); // If no pets found (404), set pets to an empty array.
            } else {
                setError(error.response?.data?.message || 'Failed to fetch pets.');
            }
        }
    };

    // Effect hook to fetch pets when the component mounts or the token changes.
    useEffect(() => {
        fetchPets();
    }, [token]); // Dependency array includes token.

    // Function to handle the deletion of a pet.
    const handleDelete = async (petId) => {
        // Confirmation dialog before deleting.
        if (!window.confirm(`Are you sure you want to delete this pet?`)) {
            return;
        }
        setError(''); // Clear previous errors.
        try {
            // API call to delete the specified pet.
            await axios.delete(`https://mishtika.duckdns.org/pets/${petId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Re-fetch pets list to reflect the deletion.
            fetchPets();
        } catch (error) {
            console.error('Error deleting pet:', error);
            setError(error.response?.data?.message || 'Failed to delete pet.');
        }
    };

    // Renders the pet profile page, including a list of pets and action buttons.
    return (
        <Container className={`${styles.petProfileContainer} mt-5`}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                 <h1 className={styles.petProfileTitle}>Your Pets</h1>
                 {/* Link to the form for adding a new pet. */}
                 <Link to="/petform">
                     <Button variant="success">
                         <FaPlus className="me-2" /> Add Pet
                     </Button>
                 </Link>
            </div>

            {/* Displays error messages if any. */}
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Message displayed if the user has no pets and no error occurred. */}
            {pets.length === 0 && !error && <p>You haven't added any pets yet. Click "Add Pet" to get started!</p>}

            {/* List of pets. */}
            <ListGroup>
                {pets.map((pet) => (
                    <ListGroup.Item key={pet._id} className={styles.petItem}>
                        <Row className="align-items-center">
                            {/* Pet picture display column. */}
                            <Col xs={12} md={4} className="text-center mb-3 mb-md-0">
                                {pet.pictures && pet.pictures.length > 0 ? (
                                    <div className={styles.imageContainer}>
                                        <img
                                            src={pet.pictures[0]} // Displays the first picture.
                                            alt={`${pet.name}`}
                                            className={styles.petImage}
                                            onError={(e) => { e.target.style.display = 'none'; /* Hide if image fails to load. */ }}
                                        />
                                    </div>
                                ) : (
                                     // Placeholder if no picture is available.
                                     <div className={styles.imagePlaceholder}>
                                         {pet.species === 'Cat' ? <FaCat size={80} /> : <FaDog size={80} />}
                                     </div>
                                )}
                            </Col>
                            {/* Pet information display column. */}
                            <Col xs={12} md={5}>
                                <div className={styles.petInfoContainer}>
                                    <strong className={styles.petName}>{pet.name}</strong>
                                    {/* Species and breed information. */}
                                    <div className={styles.speciesInfo}>
                                        {pet.species === 'Cat' ? <FaCat className={styles.speciesIcon} aria-hidden="true" /> : <FaDog className={styles.speciesIcon} aria-hidden="true" />}
                                        <span className={styles.speciesName}>{pet.species} ({pet.breed})</span>
                                    </div>
                                    {/* Gender information. */}
                                    <div className={styles.petInfo}>
                                        {pet.gender === 'Male' ? <FaMars className={styles.infoIcon} aria-hidden="true" /> : <FaVenus className={styles.infoIcon} aria-hidden="true" />}
                                        <span>{pet.gender}</span>
                                    </div>
                                    {/* Weight information. */}
                                    <div className={styles.petInfo}>
                                        <FaWeight className={styles.infoIcon} aria-hidden="true" />
                                        <span>{pet.weight} kg</span>
                                    </div>
                                    {/* Age information. */}
                                    <div className={styles.petInfo}>
                                        <FaCalendarAlt className={styles.infoIcon} aria-hidden="true" />
                                        <span>{pet.ageYears} years, {pet.ageMonths} months</span>
                                    </div>
                                    {/* Medical information (if available). */}
                                    {pet.medicalInfo && (
                                        <div className={styles.petInfo}>
                                            <strong>Medical Info:</strong> {pet.medicalInfo}
                                        </div>
                                    )}
                                </div>
                            </Col>
                            {/* Action buttons (Edit, Delete) column. */}
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

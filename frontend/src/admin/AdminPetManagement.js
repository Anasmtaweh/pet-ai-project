import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './AdminPetManagement.module.css';
import { FaDog, FaCat } from 'react-icons/fa'; // Icons for pet species

// AdminPetManagement component for displaying and managing pets.
function AdminPetManagement() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Pet Management";
    }, []);

    // State for storing the list of pets.
    const [pets, setPets] = useState([]);
    // State for controlling the visibility of the delete confirmation modal.
    const [showModal, setShowModal] = useState(false);
    // State for storing the ID of the pet to be deleted.
    const [petToDelete, setPetToDelete] = useState(null);
    // State for storing error messages.
    const [error, setError] = useState('');
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Function to fetch pets from the backend.
    const fetchPets = async () => {
        setError(''); // Clear previous errors.
        if (!token) {
            setError("Admin not logged in.");
            return;
        }
        try {
            // API call to get all pets for admin view.
            const response = await axios.get('https://mishtika.duckdns.org/admin/pets', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPets(response.data); // Update state with fetched pets.
        } catch (err) {
            console.error('Error fetching pets:', err);
            setError(err.response?.data?.message || 'An error occurred while fetching pets.');
        }
    };

    // Effect hook to fetch pets when the component mounts or the token changes.
    useEffect(() => {
        fetchPets();
    }, [token]); // Dependency array includes token to re-fetch if token changes.

    // Function to show the delete confirmation modal.
    const handleShowModal = (petId) => {
        setPetToDelete(petId); // Set the ID of the pet to be deleted.
        setShowModal(true);    // Show the modal.
    };

    // Function to close the delete confirmation modal.
    const handleCloseModal = () => {
        setShowModal(false);   // Hide the modal.
        setPetToDelete(null); // Clear the pet to delete ID.
    };

    // Function to handle the deletion of a pet.
    const handleDeletePet = async () => {
        if (!petToDelete) return; // Do nothing if no pet is selected for deletion.
        setError(''); // Clear previous errors.
        try {
            // API call to delete the selected pet.
            await axios.delete(`https://mishtika.duckdns.org/admin/pets/${petToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Re-fetch pets list to reflect the deletion.
            fetchPets();
            // Or filter locally: setPets(pets.filter((pet) => pet._id !== petToDelete));
            handleCloseModal(); // Close the modal after successful deletion.
        } catch (err) {
            console.error('Error deleting pet:', err);
            setError(err.response?.data?.message || 'An error occurred while deleting pet.');
            // Keep modal open on error? Or close? Currently closes.
            handleCloseModal(); // Close modal even on error.
        }
    };

    // Renders the pet management table and delete confirmation modal.
    return (
        <Container className={styles.petManagementContainer}>
            <h2 className={styles.petManagementTitle}>Pet Management</h2>
            {error && <div className={`alert alert-danger`}>{error}</div>}
            <Table striped bordered hover responsive className={styles.petManagementTable}> {/* Added responsive for better table display on small screens */}
                <thead>
                    <tr>
                        <th>Pet Name</th>
                        <th>Owner (User Email)</th>
                        <th>Species</th>
                        <th>Breed</th>
                        <th>Age</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pets.map((pet) => (
                        <tr key={pet._id}>
                            <td>{pet.name}</td>
                            <td>{pet.ownerName || 'N/A'}</td> {/* Display ownerName populated from backend */}
                            <td>
                                {/* Display species icon based on pet.species */}
                                {pet.species === 'Dog' ? <FaDog /> : pet.species === 'Cat' ? <FaCat /> : ''} {pet.species}
                            </td>
                            <td>{pet.breed}</td>
                            <td>{pet.ageYears}y, {pet.ageMonths}m</td>
                            <td>
                                <Button variant="danger" size="sm" className={styles.actionButton} onClick={() => handleShowModal(pet._id)}>
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                     {/* Display message if no pets are found and no error occurred */}
                     {pets.length === 0 && !error && (
                        <tr>
                            <td colSpan="6" className="text-center">No pets found in the system.</td>
                        </tr>
                     )}
                </tbody>
            </Table>

            {/* Modal for confirming pet deletion */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <Modal.Body>Are you sure you want to delete this pet? This action cannot be undone.</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeletePet}>
                        Delete Pet
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default AdminPetManagement;




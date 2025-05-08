import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './AdminPetManagement.module.css';
import { FaDog, FaCat } from 'react-icons/fa'; // Removed gender icons

function AdminPetManagement() {
    useEffect(() => {
        document.title = "MISHTIKA - Pet Management";
    }, []);
    const [pets, setPets] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [petToDelete, setPetToDelete] = useState(null);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    const fetchPets = async () => { // Moved fetch logic
        setError('');
        if (!token) {
            setError("Admin not logged in.");
            return;
        }
        try {
            const response = await axios.get('https://mishtika.duckdns.org/admin/pets', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPets(response.data);
        } catch (err) {
            console.error('Error fetching pets:', err);
            setError(err.response?.data?.message || 'An error occurred while fetching pets.');
        }
    };

    useEffect(() => {
        fetchPets();
    }, [token]);

    const handleShowModal = (petId) => {
        setPetToDelete(petId);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setPetToDelete(null);
    };

    const handleDeletePet = async () => {
        if (!petToDelete) return;
        setError('');
        try {
            await axios.delete(`https://mishtika.duckdns.org/admin/pets/${petToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Re-fetch after delete
            fetchPets();
            // Or filter locally: setPets(pets.filter((pet) => pet._id !== petToDelete));
            handleCloseModal();
        } catch (err) {
            console.error('Error deleting pet:', err);
            setError(err.response?.data?.message || 'An error occurred while deleting pet.');
            // Keep modal open on error? Or close? Currently closes.
            handleCloseModal();
        }
    };

    return (
        <Container className={styles.petManagementContainer}>
            <h2 className={styles.petManagementTitle}>Pet Management</h2>
            {error && <div className={`alert alert-danger`}>{error}</div>}
            <Table striped bordered hover responsive className={styles.petManagementTable}> {/* Added responsive */}
                <thead>
                    <tr>
                        <th>Pet Name</th>
                        <th>Owner (User Email)</th>
                        <th>Species</th>
                        {/* NO Gender Header */}
                        <th>Breed</th>
                        <th>Age</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pets.map((pet) => (
                        <tr key={pet._id}>
                            <td>{pet.name}</td>
                            <td>{pet.ownerName || 'N/A'}</td> {/* Use ownerName from backend */}
                            <td>
                                {pet.species === 'Dog' ? <FaDog /> : pet.species === 'Cat' ? <FaCat /> : ''} {pet.species}
                            </td>
                            {/* NO Gender Cell */}
                            <td>{pet.breed}</td>
                            <td>{pet.ageYears}y, {pet.ageMonths}m</td>
                            <td>
                                <Button variant="danger" size="sm" className={styles.actionButton} onClick={() => handleShowModal(pet._id)}>
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                     {pets.length === 0 && !error && (
                        <tr>
                            <td colSpan="6" className="text-center">No pets found in the system.</td>
                        </tr>
                     )}
                </tbody>
            </Table>

            {}
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



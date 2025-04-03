import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './AdminPetManagement.module.css';
import { FaDog, FaCat } from 'react-icons/fa';


function AdminPetManagement() {
    useEffect(() => {
        document.title = "MISHTIKA - Pet Management";
    }, []);
    const [pets, setPets] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [petToDelete, setPetToDelete] = useState(null);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchPets = async () => {
            try {
                const response = await axios.get('http://localhost:3001/admin/pets', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setPets(response.data);
            } catch (err) {
                console.error('Error fetching pets:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching pets.');
            }
        };

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
        try {
            await axios.delete(`http://localhost:3001/admin/pets/${petToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPets(pets.filter((pet) => pet._id !== petToDelete));
            handleCloseModal();
        } catch (err) {
            console.error('Error deleting pet:', err);
            setError(err.response?.data?.message || 'An error occurred while deleting pet.');
        }
    };

    return (
        <Container className={styles.petManagementContainer}>
            <h2 className={styles.petManagementTitle}>Pet Management</h2>
            {error && <div className={`alert alert-danger`}>{error}</div>}
            <Table striped bordered hover className={styles.petManagementTable}>
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
                            <td>{pet.ownerName}</td>
                            <td>
                                {pet.species === 'Dog' ? <FaDog /> : pet.species === 'Cat' ? <FaCat /> : pet.species}
                            </td>
                            <td>{pet.breed}</td>
                            <td>{pet.ageYears} years, {pet.ageMonths} months</td>
                            <td>                               
                                <Button variant="danger" className={styles.actionButton} onClick={() => handleShowModal(pet._id)}>
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <Modal.Body>Are you sure you want to delete this pet?</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeletePet}>
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
       
    );
}

export default AdminPetManagement;


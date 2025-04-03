import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './AdminUserManagement.module.css';

function AdminUserManagement() {
    useEffect(() => {
        document.title = "MISHTIKA - User Management";
    }, []);

    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('http://localhost:3001/admin/users', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUsers(response.data);
            } catch (err) {
                console.error('Error fetching users:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching users.');
            }
        };

        fetchUsers();
    }, [token]);

    const handleShowModal = (userId) => {
        setUserToDelete(userId);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setUserToDelete(null);
    };

    const handleDeleteUser = async () => {
        try {
            await axios.delete(`http://localhost:3001/admin/users/${userToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(users.filter((user) => user._id !== userToDelete));
            handleCloseModal();
        } catch (err) {
            console.error('Error deleting user:', err);
            setError(err.response?.data?.message || 'An error occurred while deleting user.');
        }
    };

    const handleToggleStatus = async (userId, isActive) => {
        try {
            await axios.put(`http://localhost:3001/admin/users/${userId}`, { isActive }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(users.map((user) =>
                user._id === userId ? { ...user, isActive: !user.isActive } : user
            ));
        } catch (err) {
            console.error('Error toggling user status:', err);
            setError(err.response?.data?.message || 'An error occurred while toggling user status.');
        }
    };

    return (
        <Container className={styles.userManagementContainer}>
            <h2 className={styles.userManagementTitle}>User Management</h2>
            {error && <div className={`alert alert-danger ${styles.alertDanger}`}>{error}</div>}
            <Table striped bordered hover className={styles.userManagementTable}>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Registration Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user._id}>
                            <td>{user.email}</td>
                            <td>{user.role}</td>
                            <td>{new Date(user.createdAt).toLocaleString()}</td>
                            <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                            <td className={styles.actionButtons}>
                                <Button variant="danger" size='sm' className={styles.actionButton} onClick={() => handleShowModal(user._id)}>
                                    Delete
                                </Button>
                                <Button
                                    variant={user.isActive ? 'warning' : 'success'}
                                    size='sm'
                                    className={`${styles.actionButton} ms-2`}
                                    onClick={() => handleToggleStatus(user._id, user.isActive)}
                                >
                                    {user.isActive ? 'Deactivate' : 'Activate'}
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
                <Modal.Body>Are you sure you want to delete this user?</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteUser}>
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
        
    );
}

export default AdminUserManagement;


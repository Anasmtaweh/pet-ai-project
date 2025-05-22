import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import styles from './AdminUserManagement.module.css';

// AdminUserManagement component for displaying and managing users.
function AdminUserManagement() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - User Management";
    }, []);

    // State for storing the list of users.
    const [users, setUsers] = useState([]);
    // State for controlling the visibility of the delete confirmation modal.
    const [showModal, setShowModal] = useState(false);
    // State for storing the ID of the user to be deleted.
    const [userToDelete, setUserToDelete] = useState(null);
    // State for storing error messages.
    const [error, setError] = useState('');
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Effect hook to fetch users when the component mounts or the token changes.
    useEffect(() => {
        // Function to fetch users from the backend.
        const fetchUsers = async () => {
            try {
                // API call to get all users for admin view.
                const response = await axios.get('https://mishtika.duckdns.org/admin/users', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUsers(response.data); // Update state with fetched users.
            } catch (err) {
                console.error('Error fetching users:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching users.');
            }
        };

        fetchUsers();
    }, [token]); // Dependency array includes token to re-fetch if token changes.

    // Function to show the delete confirmation modal.
    const handleShowModal = (userId) => {
        setUserToDelete(userId); // Set the ID of the user to be deleted.
        setShowModal(true);    // Show the modal.
    };

    // Function to close the delete confirmation modal.
    const handleCloseModal = () => {
        setShowModal(false);   // Hide the modal.
        setUserToDelete(null); // Clear the user to delete ID.
    };

    // Function to handle the deletion of a user.
    const handleDeleteUser = async () => {
        try {
            // API call to delete the selected user.
            await axios.delete(`https://mishtika.duckdns.org/admin/users/${userToDelete}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Update local state by filtering out the deleted user.
            setUsers(users.filter((user) => user._id !== userToDelete));
            handleCloseModal(); // Close the modal after successful deletion.
        } catch (err) {
            console.error('Error deleting user:', err);
            setError(err.response?.data?.message || 'An error occurred while deleting user.');
        }
    };

    // Function to handle setting the active/inactive status of a user.
    const handleSetStatus = async (userId, desiredStatus) => { // Accepts the user ID and the desired boolean status.
        try {
            // API call to update the user's status.
            // Sends the desired status directly to the backend.
            await axios.put(`https://mishtika.duckdns.org/admin/users/${userId}`,
                { isActive: desiredStatus }, // Payload includes the desired status.
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            // Update local state to reflect the change immediately.
            setUsers(users.map((user) =>
                user._id === userId ? { ...user, isActive: desiredStatus } : user
            ));
        } catch (err) {
            console.error('Error setting user status:', err);
            setError(err.response?.data?.message || 'An error occurred while setting user status.');
        }
    };

    // Renders the user management table, action buttons, and delete confirmation modal.
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

                                {/* Conditional rendering for Activate/Deactivate button based on user's current status. */}
                                {user.isActive ? (
                                    // If user is Active, show Deactivate button.
                                    <Button
                                        variant={'warning'}
                                        size='sm'
                                        className={`${styles.actionButton} ms-2`}
                                        // Calls handleSetStatus to set isActive to false.
                                        onClick={() => handleSetStatus(user._id, false)}
                                    >
                                        Deactivate
                                    </Button>
                                ) : (
                                    // If user is Inactive, show Activate button.
                                    <Button
                                        variant={'success'}
                                        size='sm'
                                        className={`${styles.actionButton} ms-2`}
                                        // Calls handleSetStatus to set isActive to true.
                                        onClick={() => handleSetStatus(user._id, true)}
                                    >
                                        Activate
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {/* Modal for confirming user deletion. */}
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


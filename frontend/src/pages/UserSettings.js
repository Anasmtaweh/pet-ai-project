import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './UserSettings.module.css'; // Import the CSS Module

// UserSettings component for managing user profile and password.
function UserSettings() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - User Settings";
    }, []);

    // State variables for password change form.
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    // State variables for profile change form.
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    // State for displaying error and success messages.
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Effect hook to fetch user data when the component mounts or token changes.
    useEffect(() => {
        // Function to fetch the current user's profile data.
        const fetchUserData = async () => {
            try {
                // API call to get the current user's data.
                const response = await axios.get('https://mishtika.duckdns.org/auth/user', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userData = response.data;
                // Set state with fetched user data.
                setName(userData.username);
                setAge(userData.age);
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching user data.');
            }
        };

        fetchUserData();
    }, [token]); // Dependency array includes token.

    // Handler function for submitting the password change form.
    const handlePasswordChange = async (e) => {
        e.preventDefault(); // Prevents default form submission.
        // Clears previous messages.
        setError('');
        setSuccess('');

        // Client-side validation: Check if new passwords match.
        if (newPassword !== confirmNewPassword) {
            setError('New passwords do not match.');
            return;
        }
        // Client-side validation: Check new password complexity.
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-])[A-Za-z\d@$!%*?&#+-]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long');
            return;
        }
        // Client-side validation: Check if new password is different from current.
        if (currentPassword === newPassword) {
            setError('New password must be different from the current password.');
            return;
        }

        try {
            // API call to update the user's password.
            await axios.put(
                'https://mishtika.duckdns.org/auth/settings/password',
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Display success message and clear password fields.
            setSuccess('Password updated successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            console.error('Error updating password:', err);
            setError(err.response?.data?.message || 'An error occurred while updating password.');
        }
    };

    // Handler function for submitting the profile change form.
    const handleProfileChange = async (e) => {
        e.preventDefault(); // Prevents default form submission.
        // Clears previous messages.
        setError('');
        setSuccess('');
        // Client-side validation: Check age range.
        if (age < 13 || age > 120) {
            setError('Age must be between 13 and 120.');
            return;
        }
        // Client-side validation: Check name length.
        if (name.length < 3) {
            setError('Name must be at least 3 characters long.');
            return;
        }
        try {
            // API call to update the user's profile (username and age).
            await axios.put(
                'https://mishtika.duckdns.org/auth/settings/profile',
                { username: name, age },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Display success message.
            setSuccess('Profile updated successfully.');
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(err.response?.data?.message || 'An error occurred while updating profile.');
        }
    };

    // Renders the user settings form with sections for password and profile changes.
    return (
        <Container className={`${styles.userSettingsContainer} mt-5`}>
            <h1 className={styles.userSettingsTitle}>User Settings</h1>
            {/* Display error or success messages */}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Form for changing password */}
            <Form onSubmit={handlePasswordChange}>
                <h2 className={styles.formTitle}>Change Password</h2>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Current Password</Form.Label>
                    <Form.Control className={styles.formControl} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>New Password</Form.Label>
                    <Form.Control className={styles.formControl} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Confirm New Password</Form.Label>
                    <Form.Control className={styles.formControl} type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                </Form.Group>
                <Button className={`${styles.userSettingsButton} ${styles.passwordButton}`} variant="primary" type="submit">
                    Save Password Changes
                </Button>
            </Form>

            {/* Form for changing profile information */}
            <Form onSubmit={handleProfileChange}>
                <h2 className={styles.formTitle}>Change Profile</h2>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={age} onChange={(e) => setAge(e.target.value)} required min="13" max="120" />
                </Form.Group>
                <Button className={`${styles.userSettingsButton} ${styles.profileButton}`} variant="primary" type="submit">
                    Save Profile Changes
                </Button>
            </Form>
        </Container>
    );
}

export default UserSettings;


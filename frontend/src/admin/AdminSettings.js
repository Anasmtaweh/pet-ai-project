import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './AdminSettings.module.css';

// AdminSettings component for managing admin user profile and password.
function AdminSettings() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Admin Settings";
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

    // Effect hook to fetch admin user data when the component mounts or token changes.
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // API call to get the current admin user's profile data.
                const response = await axios.get('https://mishtika.duckdns.org/admin/user', { // Use /admin/user
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userData = response.data;
                // Set state with fetched user data.
                setName(userData.username);
                setAge(userData.age);
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching user data.');
                // Clear error after 5 seconds
                setTimeout(() => setError(''), 5000);
            }
        };

        fetchUserData();
    }, [token]); // Dependency array includes token.

    // Handler function for submitting the password change form.
    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Client-side validation: Check if new passwords match.
        if (newPassword !== confirmNewPassword) {
            setError('New passwords do not match.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        // Client-side validation: Check new password complexity using regex.
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-])[A-Za-z\d@$!%*?&#+-]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        try {
            // API call to update the admin's password.
            await axios.put(
                'https://mishtika.duckdns.org/admin/settings/password',
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Display success message and clear password fields on success.
            setSuccess('Password updated successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            console.error('Error updating password:', err);
            setError(err.response?.data?.message || 'An error occurred while updating password.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
        }
    };

    // Handler function for submitting the profile change form.
    const handleProfileChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Client-side validation: Check age range.
        if (age < 13 || age > 120) {
            setError('Age must be between 13 and 120.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        try {
            // API call to update the admin's profile (username and age).
            await axios.put(
                'https://mishtika.duckdns.org/admin/settings/profile',
                { username: name, age },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Display success message on success.
            setSuccess('Profile updated successfully.');
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(err.response?.data?.message || 'An error occurred while updating profile.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
        }
    };

    // Renders the admin settings form with sections for password and profile changes.
    return (
        <Container className={styles.settingsContainer}>
            <h1 className={styles.settingsTitle}>Admin Settings</h1>
            {/* Display error or success messages */}
            {error && <div className={`alert alert-danger`}>{error}</div>}
            {success && <div className={`alert alert-success`}>{success}</div>}

            {/* Form for changing password */}
            <Form className={styles.settingsSection} onSubmit={handlePasswordChange}>
                <h2 className={styles.settingsSectionTitle}>Change Password</h2>
                <Form.Group className="mb-3 form-group">
                    <Form.Label className={styles.formLabel}>Current Password</Form.Label>
                    <Form.Control type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3 form-group">
                    <Form.Label className={styles.formLabel}>New Password</Form.Label>
                    <Form.Control type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3 form-group">
                    <Form.Label className={styles.formLabel}>Confirm New Password</Form.Label>
                    <Form.Control type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                </Form.Group>
                <Button className={styles.saveButton} variant="primary" type="submit">
                    Save Password Changes
                </Button>
            </Form>

            {/* Form for changing profile information */}
            <Form className={styles.settingsSection} onSubmit={handleProfileChange}>
                <h2 className={styles.settingsSectionTitle}>Change Profile</h2>
                <Form.Group className="mb-3 form-group">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3 form-group">
                    <Form.Label className={styles.formLabel}>Age</Form.Label>
                    <Form.Control type="number" value={age} onChange={(e) => setAge(e.target.value)} required min="13" max="120" />
                </Form.Group>
                <Button className={styles.saveButton} variant="primary" type="submit">
                    Save Profile Changes
                </Button>
            </Form>
        </Container>
    );
}

export default AdminSettings;

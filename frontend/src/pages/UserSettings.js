import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './UserSettings.module.css'; // Import the CSS Module

function UserSettings() {
    useEffect(() => {
        document.title = "MISHTIKA - User Settings";
    }, []);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await axios.get('http://localhost:3001/auth/user', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userData = response.data;
                setName(userData.username);
                setAge(userData.age);
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching user data.');
            }
        };

        fetchUserData();
    }, [token]);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmNewPassword) {
            setError('New passwords do not match.');
            return;
        }
        // Basic password validation on the frontend
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-])[A-Za-z\d@$!%*?&#+-]{8,}$/; // Updated regex here
        if (!passwordRegex.test(newPassword)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long');
            return;
        }
        if (currentPassword === newPassword) {
            setError('New password must be different from the current password.');
            return;
        }

        try {
            await axios.put(
                'http://localhost:3001/auth/settings/password',
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Password updated successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            console.error('Error updating password:', err);
            setError(err.response?.data?.message || 'An error occurred while updating password.');
        }
    };
    const handleProfileChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        // Validate age on the frontend
        if (age < 13 || age > 120) {
            setError('Age must be between 13 and 120.');
            return;
        }
        if (name.length < 3) {
            setError('Name must be at least 3 characters long.');
            return;
        }
        try {
            await axios.put(
                'http://localhost:3001/auth/settings/profile',
                { username: name, age },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Profile updated successfully.');
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(err.response?.data?.message || 'An error occurred while updating profile.');
        }
    };

    return (
        <Container className={`${styles.userSettingsContainer} mt-5`}> {/* Apply the CSS Module class */}
            <h1 className={styles.userSettingsTitle}>User Settings</h1> {/* Apply the CSS Module class */}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <Form onSubmit={handlePasswordChange}>
                <h2 className={styles.formTitle}>Change Password</h2> {/* Apply the CSS Module class */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Current Password</Form.Label> {/* Apply the CSS Module class */}
                    <Form.Control className={styles.formControl} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /> {/* Apply the CSS Module class */}
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>New Password</Form.Label> {/* Apply the CSS Module class */}
                    <Form.Control className={styles.formControl} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /> {/* Apply the CSS Module class */}
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Confirm New Password</Form.Label> {/* Apply the CSS Module class */}
                    <Form.Control className={styles.formControl} type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required /> {/* Apply the CSS Module class */}
                </Form.Group>
                <Button className={`${styles.userSettingsButton} ${styles.passwordButton}`} variant="primary" type="submit"> {/* Apply the CSS Module class */}
                    Save Password Changes
                </Button>
            </Form>
            <Form onSubmit={handleProfileChange}>
                <h2 className={styles.formTitle}>Change Profile</h2> {/* Apply the CSS Module class */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label> {/* Apply the CSS Module class */}
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required /> {/* Apply the CSS Module class */}
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age</Form.Label> {/* Apply the CSS Module class */}
                    <Form.Control className={styles.formControl} type="number" value={age} onChange={(e) => setAge(e.target.value)} required min="13" max="120" /> {/* Apply the CSS Module class */}
                </Form.Group>
                <Button className={`${styles.userSettingsButton} ${styles.profileButton}`} variant="primary" type="submit"> {/* Apply the CSS Module class */}
                    Save Profile Changes
                </Button>
            </Form>
        </Container>
    );
}

export default UserSettings;

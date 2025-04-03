import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './AdminSettings.module.css';

function AdminSettings() {
    useEffect(() => {
        document.title = "MISHTIKA - Admin Settings";
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
                // Clear error after 5 seconds
                setTimeout(() => setError(''), 5000);
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
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-])[A-Za-z\d@$!%*?&#+-]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        try {
            await axios.put(
                'http://localhost:3001/admin/settings/password',
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
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
        }
    };

    const handleProfileChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (age < 13 || age > 120) {
            setError('Age must be between 13 and 120.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
            return;
        }

        try {
            await axios.put(
                'http://localhost:3001/admin/settings/profile',
                { username: name, age },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Profile updated successfully.');
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(err.response?.data?.message || 'An error occurred while updating profile.');
            setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
        }
    };

    return (
        <Container className={styles.settingsContainer}>
            <h1 className={styles.settingsTitle}>Admin Settings</h1>
            {error && <div className={`alert alert-danger`}>{error}</div>}
            {success && <div className={`alert alert-success`}>{success}</div>}

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
import React, { useState } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useParams, useNavigate } from 'react-router-dom'; // Hooks for accessing URL parameters and navigation.
import styles from './Login.module.css'; // Reuses styles from the Login page.

// ResetPassword component for setting a new password using a reset token.
function ResetPassword() {
    // State for storing the new password input.
    const [password, setPassword] = useState('');
    // State for displaying success messages.
    const [message, setMessage] = useState('');
    // State for displaying error messages.
    const [error, setError] = useState('');
    // Hook to get the 'token' parameter from the URL.
    const { token } = useParams();
    // Hook for programmatic navigation.
    const navigate = useNavigate();

    // Handler function for submitting the reset password form.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevents default form submission behavior.
        // Clears previous messages.
        setMessage('');
        setError('');

        try {
            // API call to the backend to reset the password using the token and new password.
            await axios.post(`https://mishtika.duckdns.org/auth/reset-password/${token}`, { password });
            // Sets a success message.
            setMessage('Password reset successfully.');
            // Navigates to the login page after a short delay.
            setTimeout(() => {
                navigate('/login'); // Redirects to login page.
            }, 2000); // 2-second delay.
        } catch (err) {
            // Sets an error message if the API call fails or returns an error.
            setError(err.response?.data?.message || 'An error occurred');
        }
    };

    // Renders the reset password form.
    return (
        <Container className={`${styles.loginContainer} mt-5`}>
            <h1 className={styles.loginTitle}>Reset Password</h1>
            {/* Displays success or error messages */}
            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label>New Password</Form.Label>
                    <Form.Control
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required // Makes the password field mandatory.
                    />
                </Form.Group>
                <Button className={styles.loginButton} type="submit">
                    Reset Password
                </Button>
            </Form>
        </Container>
    );
}

export default ResetPassword;

import React, { useState } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import styles from './Login.module.css'; // Reuses styles from the Login page.

// ForgotPassword component for handling password reset requests.
function ForgotPassword() {
    // State for storing the user's email input.
    const [email, setEmail] = useState('');
    // State for displaying success messages (e.g., "email sent").
    const [message, setMessage] = useState('');
    // State for displaying error messages.
    const [error, setError] = useState('');

    // Handler function for submitting the forgot password form.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevents default form submission behavior.
        // Clears previous messages.
        setMessage('');
        setError('');

        try {
            // API call to the backend to request a password reset link for the provided email.
            await axios.post('https://mishtika.duckdns.org/auth/forgot-password', { email });
            // Sets a success message indicating that the email has been sent.
            setMessage('Password reset email sent. Please check your inbox.');
        } catch (err) {
            // Sets an error message if the API call fails or returns an error.
            setError(err.response?.data?.message || 'An error occurred');
        }
    };

    // Renders the forgot password form.
    return (
        <Container className={`${styles.loginContainer} mt-5`}>
            <h1 className={styles.loginTitle}>Forgot Password</h1>
            {/* Displays success or error messages */}
            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required // Makes the email field mandatory.
                    />
                </Form.Group>
                <Button className={styles.loginButton} type="submit">
                    Send Reset Link
                </Button>
            </Form>
        </Container>
    );
}

export default ForgotPassword;


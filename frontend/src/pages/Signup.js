import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import styles from './Signup.module.css'; // Import the CSS Module

// Signup component for new user registration.
function Signup() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Signup";
    }, []);

    // State variables for form inputs and error messages.
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [age, setAge] = useState('');
    const [error, setError] = useState('');
    // Hook for programmatic navigation.
    const navigate = useNavigate();

    // Handler function for submitting the signup form.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevents default form submission behavior.
        setError(''); // Clear previous errors.

        // Basic client-side password validation for complexity.
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-.])[A-Za-z\d@$!%*?&#+\-.]{8,}$/;
        if (!passwordRegex.test(password)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long');
            return;
        }

        try {
            // API call to the backend signup endpoint.
            const response = await axios.post('https://mishtika.duckdns.org/auth/signup', {
                email,
                password,
                username,
                age,
            });

            console.log('Signup successful:', response.data);
            // Redirect to the login page after successful signup.
            navigate('/');
        } catch (err) {
            console.error('Signup error:', err.response?.data || err.message);
            // Sets an appropriate error message based on the API response.
            if (err.response?.data?.message === 'User already exists') {
                setError('A user with this email already exists.');
            } else if(err.response?.data?.message === 'All fields are required'){
                setError('All fields are required.');
            }
             else {
                setError('An error occurred during signup.');
            }
        }
    };

    // Renders the signup form.
    return (
        <Container className={`${styles.signupContainer} mt-5`}>
            <h1 className={styles.signupTitle}>Signup Page</h1>
            {/* Displays error messages if any */}
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                {/* Email input field */}
                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicEmail">
                    <Form.Label className={styles.formLabel}>Email address</Form.Label>
                    <Form.Control className={styles.formControl} type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                {/* Password input field */}
                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicPassword">
                    <Form.Label className={styles.formLabel}>Password</Form.Label>
                    <Form.Control className={styles.formControl} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>

                {/* Username input field */}
                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicUsername">
                    <Form.Label className={styles.formLabel}>Username</Form.Label>
                    <Form.Control className={styles.formControl} type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </Form.Group>

                {/* Age input field */}
                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicAge">
                    <Form.Label className={styles.formLabel}>Age</Form.Label>
                    <Form.Control className={styles.formControl} type="number" placeholder="Enter age" value={age} onChange={(e) => setAge(e.target.value)} required min="13" max="120" />
                </Form.Group>

                {/* Signup button */}
                <Button className={`${styles.signupButton}`} variant="primary" type="submit">
                    Signup
                </Button>
            </Form>
        </Container>
    );
}

export default Signup;


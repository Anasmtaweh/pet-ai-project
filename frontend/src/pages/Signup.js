import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import styles from './Signup.module.css'; // Import the CSS Module

function Signup() {
    useEffect(() => {
        document.title = "MISHTIKA - Signup";
    }, []);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [age, setAge] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        // Basic password validation on the frontend
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-])[A-Za-z\d@$!%*?&#+-]{8,}$/; // Updated regex here
        if (!passwordRegex.test(password)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be at least 8 characters long');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/auth/signup', {
                email,
                password,
                username,
                age,
            });

            console.log('Signup successful:', response.data);
            // Redirect to login after signup
            navigate('/');
        } catch (err) {
            console.error('Signup error:', err.response?.data || err.message);
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

    return (

        <Container className={`${styles.signupContainer} mt-5`}>
            <h1 className={styles.signupTitle}>Signup Page</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicEmail">
                    <Form.Label className={styles.formLabel}>Email address</Form.Label>
                    <Form.Control className={styles.formControl} type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicPassword">
                    <Form.Label className={styles.formLabel}>Password</Form.Label>
                    <Form.Control className={styles.formControl} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>

                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicUsername">
                    <Form.Label className={styles.formLabel}>Username</Form.Label>
                    <Form.Control className={styles.formControl} type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </Form.Group>

                <Form.Group className={`mb-3 ${styles.formGroup}`} controlId="formBasicAge">
                    <Form.Label className={styles.formLabel}>Age</Form.Label>
                    <Form.Control className={styles.formControl} type="number" placeholder="Enter age" value={age} onChange={(e) => setAge(e.target.value)} required min="13" max="120" />
                </Form.Group>

                <Button className={`${styles.signupButton}`} variant="primary" type="submit">
                    Signup
                </Button>
            </Form>
        </Container>

    );
}

export default Signup;

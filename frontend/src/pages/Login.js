import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import styles from './Login.module.css'; // Import the CSS Module

// Login component for user authentication.
function Login() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Login";
    }, []);

    // State variables for email, password, and error messages.
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    // Hook for programmatic navigation.
    const navigate = useNavigate();

    // Handler function for submitting the login form.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevents default form submission behavior.
        setError(''); // Clears previous errors.

        try {
            // API call to the backend login endpoint.
            const response = await axios.post('https://mishtika.duckdns.org/auth/login', {
                email,
                password,
            });

            console.log('Login successful:', response.data);
            // Store the authentication token in local storage.
            localStorage.setItem('token', response.data.token);
            // Redirect user based on their role (admin or regular user).
            if (response.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/petprofile');
            }
        } catch (err) {
            console.error('Login error:', err.response?.data || err.message);
            // Sets an appropriate error message based on the API response.
            if (err.response?.data?.message === 'Invalid credentials') {
                setError('Invalid email or password.');
            } else {
                setError('An error occurred during login.');
            }
        }
    };

    // Renders the login form and links for password reset, signup, and admin login.
    return (
        <Container className={styles.loginContainer}> {/* Use the CSS Module class */}
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <h1 className={styles.loginTitle}>Login Page</h1> {/* Use the CSS Module class */}
                    {/* Displays error messages if any */}
                    {error && <div className="alert alert-danger">{error}</div>}
                    <Form onSubmit={handleSubmit}>
                        {/* Email input field */}
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Email address</Form.Label>
                            <Form.Control type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </Form.Group>

                        {/* Password input field */}
                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </Form.Group>

                        {/* Login button */}
                        <Button variant="primary" type="submit" className={styles.loginButton}> {/* Use the CSS Module class */}
                            Login
                        </Button>
                        {/* Links for forgot password, signup, and admin login */}
                        <div className="mt-3">
                            <Link to="/forgot-password" className={styles.linkButton}>Forgot Password?</Link>
                            <p>
                                Don't have an account?{' '}
                                <Link to="/signup" className={styles.linkButton}>Signup</Link> {/* Use the new CSS Module class */}
                            </p>
                            <p>
                                Are you an admin? <Link to="/admin/login" className={styles.linkButton}>Admin Login</Link> {/* Use the new CSS Module class */}
                            </p>
                        </div>
                    </Form>
                </Col>
            </Row>
        </Container>
    );
}

export default Login;


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import styles from './Login.module.css'; // Import the CSS Module

function Login() {
    useEffect(() => {
        document.title = "MISHTIKA - Login";
    }, []);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post('http://localhost:3001/auth/login', {
                email,
                password,
            });

            console.log('Login successful:', response.data);
            // Store token in local storage
            localStorage.setItem('token', response.data.token);
            if (response.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/petprofile');
            }
        } catch (err) {
            console.error('Login error:', err.response?.data || err.message);
            if (err.response?.data?.message === 'Invalid credentials') {
                setError('Invalid email or password.');
            } else {
                setError('An error occurred during login.');
            }
        }
    };

    return (
        <Container className={styles.loginContainer}> {/* Use the CSS Module class */}
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <h1 className={styles.loginTitle}>Login Page</h1> {/* Use the CSS Module class */}
                    {error && <div className="alert alert-danger">{error}</div>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Email address</Form.Label>
                            <Form.Control type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </Form.Group>

                        <Button variant="primary" type="submit" className={styles.loginButton}> {/* Use the CSS Module class */}
                            Login
                        </Button>
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

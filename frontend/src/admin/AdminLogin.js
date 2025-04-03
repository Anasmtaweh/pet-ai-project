import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import styles from '../pages/Login.module.css'; // Import the same CSS module


function AdminLogin() {
    useEffect(() => {
        document.title = "MISHTIKA - Admin Login";
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

            localStorage.setItem('token', response.data.token);
            if (response.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                setError('Invalid credentials.');
            }
        } catch (err) {
            console.error('Admin Login error:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'An error occurred during login.');
        }
    };

    return (
        <Container className={styles.loginContainer}>
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <h1 className={styles.loginTitle}>Admin Login</h1>
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

                        <Button variant="primary" type="submit" className={styles.loginButton}>
                            Admin Login
                        </Button>
                    </Form>
                </Col>
            </Row>
        </Container>
    );
}

export default AdminLogin;
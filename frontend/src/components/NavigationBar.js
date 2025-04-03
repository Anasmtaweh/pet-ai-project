import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import styles from './NavigationBar.module.css'; // Correct import: Use CSS Module

function NavigationBar() {
    const location = useLocation();
    const isLoginPage = location.pathname === '/';
    const isSignupPage = location.pathname === '/signup';
    const isAdminLoginPage = location.pathname === '/admin/login';
    const token = localStorage.getItem('token');

    let isLoggedIn = !!token;
    let showAdminLink = false;
    let showUserLink = false;

    if (token) {
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            showAdminLink = decodedToken.role === 'admin';
            showUserLink = decodedToken.role === 'user'; // Add this line
        } catch (error) {
            console.error('Error decoding token:', error);
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.reload(); // Refresh the page to ensure protected routes are updated
    };

    return (
        !isLoginPage && !isSignupPage && !isAdminLoginPage && (
            <Navbar className={styles.navbar} data-bs-theme="dark" expand="lg"> {/* Apply the CSS Module class */}
                <Container>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            {!isLoggedIn && <Nav.Link as={Link} to="/" className={styles.navLink}>Login</Nav.Link>} {/* Apply the CSS Module class */}
                            {!isLoggedIn && <Nav.Link as={Link} to="/signup" className={styles.navLink}>Signup</Nav.Link>} {/* Apply the CSS Module class */}
                            {isLoggedIn && showUserLink && (
                                <>
                                    <Nav.Link as={Link} to="/petprofile" className={styles.navLink}>Pet Profile</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/petform" className={styles.navLink}>Add Pet</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/aichat" className={styles.navLink}>AI Chat</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/search" className={styles.navLink}>Search</Nav.Link>

                                    <Nav.Link as={Link} to="/scheduler" className={styles.navLink}>Scheduler</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/usersettings" className={styles.navLink}>Settings</Nav.Link> {/* Apply the CSS Module class */}
                                </>
                            )}
                            {isLoggedIn && showAdminLink && (
                                <>
                                    <Nav.Link as={Link} to="/admin/dashboard" className={styles.navLink}>Admin Dashboard</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/admin/users" className={styles.navLink}>User Management</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/admin/pets" className={styles.navLink}>Pet Management</Nav.Link> {/* Apply the CSS Module class */}
                                    <Nav.Link as={Link} to="/admin/settings" className={styles.navLink}>Settings</Nav.Link> {/* Apply the CSS Module class */}
                                </>
                            )}
                        </Nav>
                        {isLoggedIn && (
                            <Button variant="light" onClick={handleLogout}>
                                Logout
                            </Button>
                        )}
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        )
    );
}

export default NavigationBar;

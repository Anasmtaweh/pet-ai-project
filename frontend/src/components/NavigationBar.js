import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // For client-side navigation and getting current path.
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import styles from './NavigationBar.module.css'; // CSS Modules for component-specific styling.

// NavigationBar component that renders navigation links based on user role and login status.
function NavigationBar() {
    // Hook to get the current URL location.
    const location = useLocation();
    // Flags to determine if the current page is a login or signup page.
    const isLoginPage = location.pathname === '/';
    const isSignupPage = location.pathname === '/signup';
    const isAdminLoginPage = location.pathname === '/admin/login';
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Determines if a user is logged in based on token presence.
    let isLoggedIn = !!token;
    // Flags to control visibility of admin-specific and user-specific links.
    let showAdminLink = false;
    let showUserLink = false;

    // If a token exists, decode it to determine the user's role.
    if (token) {
        try {
            // Decodes the JWT payload (second part of the token).
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            showAdminLink = decodedToken.role === 'admin';
            showUserLink = decodedToken.role === 'user';
        } catch (error) {
            console.error('Error decoding token:', error);
            // If token decoding fails, treat user as logged out.
            isLoggedIn = false;
        }
    }

    // Function to handle user logout.
    const handleLogout = () => {
        localStorage.removeItem('token'); // Removes the token from local storage.
        window.location.reload(); // Refreshes the page to update UI and route protection.
    };

    // Conditionally renders the Navbar. It's hidden on login, signup, and admin login pages.
    return (
        !isLoginPage && !isSignupPage && !isAdminLoginPage && (
            <Navbar className={styles.navbar} data-bs-theme="dark" expand="lg">
                <Container>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            {/* Shows Login and Signup links if user is not logged in. */}
                            {!isLoggedIn && <Nav.Link as={Link} to="/" className={styles.navLink}>Login</Nav.Link>}
                            {!isLoggedIn && <Nav.Link as={Link} to="/signup" className={styles.navLink}>Signup</Nav.Link>}
                            {/* Shows user-specific links if logged in as a regular user. */}
                            {isLoggedIn && showUserLink && (
                                <>
                                    <Nav.Link as={Link} to="/petprofile" className={styles.navLink}>Pet Profile</Nav.Link>
                                    <Nav.Link as={Link} to="/petform" className={styles.navLink}>Add Pet</Nav.Link>
                                    <Nav.Link as={Link} to="/aichat" className={styles.navLink}>AI Chat</Nav.Link>
                                    <Nav.Link as={Link} to="/scheduler" className={styles.navLink}>Scheduler</Nav.Link>
                                    <Nav.Link as={Link} to="/usersettings" className={styles.navLink}>Settings</Nav.Link>
                                </>
                            )}
                            {/* Shows admin-specific links if logged in as an admin. */}
                            {isLoggedIn && showAdminLink && (
                                <>
                                    <Nav.Link as={Link} to="/admin/dashboard" className={styles.navLink}>Admin Dashboard</Nav.Link>
                                    <Nav.Link as={Link} to="/admin/users" className={styles.navLink}>User Management</Nav.Link>
                                    <Nav.Link as={Link} to="/admin/pets" className={styles.navLink}>Pet Management</Nav.Link>
                                    <Nav.Link as={Link} to="/admin/settings" className={styles.navLink}>Settings</Nav.Link>
                                </>
                            )}
                        </Nav>
                        {/* Shows Logout button if user is logged in. */}
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


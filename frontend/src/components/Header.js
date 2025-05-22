import React from 'react';
import NavigationBar from './NavigationBar'; // Component for site navigation links.
import Container from 'react-bootstrap/Container';
import { Link } from 'react-router-dom'; // For client-side navigation.
import styles from './Header.module.css'; // CSS Modules for component-specific styling.
import logo from '../assets/logo.png'; // Imports the application logo.

// Header component that displays the site logo, name, an optional page title, and the main navigation bar.
function Header({ pageTitle }) { // `pageTitle` prop to display the current page's title.
    // Checks if a user token exists in local storage to determine login status.
    const token = localStorage.getItem('token');
    const isLoggedIn = !!token;

    return (
        // Main header element with custom styling.
        <header className={styles.header}>
            <Container>
                {/* Flex container for logo/brand and page title alignment. */}
                <div className={`d-flex justify-content-between align-items-center ${styles.headerContainer}`}>
                    {/* Link wrapping the logo and brand name, navigates to pet profile if logged in, else to home. */}
                    <Link to={isLoggedIn ? "/petprofile" : "/"} className={styles.headerLink}>
                        <img src={logo} alt="MISHTIKA Logo" className={styles.headerLogo} />
                        <h1 className={styles.headerH1}>MISHTIKA</h1>
                    </Link>
                    {/* Conditionally renders the page title if provided. */}
                    {pageTitle && <h2 className="text-secondary">{pageTitle}</h2>}
                </div>
                {/* Renders the main navigation bar component. */}
                <NavigationBar />
            </Container>
        </header>
    );
}

export default Header;


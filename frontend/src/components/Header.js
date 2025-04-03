import React from 'react';
import NavigationBar from './NavigationBar';
import Container from 'react-bootstrap/Container';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import logo from '../assets/logo.png'; // Assuming you have a logo.png

function Header({ pageTitle }) {
    const token = localStorage.getItem('token');
    const isLoggedIn = !!token;
    return (
        <header className={styles.header}>
            <Container>
                <div className={`d-flex justify-content-between align-items-center ${styles.headerContainer}`}>
                    <Link to={isLoggedIn ? "/petprofile" : "/"} className={styles.headerLink}>
                        <img src={logo} alt="MISHTIKA Logo" className={styles.headerLogo} />
                        <h1 className={styles.headerH1}>MISHTIKA</h1> {/* Removed text-primary */}
                    </Link>
                    {pageTitle && <h2 className="text-secondary">{pageTitle}</h2>}
                </div>
                <NavigationBar />
            </Container>
        </header>
    );
}

export default Header;

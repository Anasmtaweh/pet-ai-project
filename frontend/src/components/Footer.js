import React from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
// Importing social media and contact icons from react-icons.
import { FaInstagram, FaReddit, FaWhatsapp, FaEnvelope, FaGithub } from 'react-icons/fa';
import styles from './Footer.module.css'; // Import the CSS Module for styling.

// Footer component displaying social media links, contact information, and copyright.
function Footer() {
    return (
        // Main footer element styled using CSS Modules.
        <footer className={styles.footer}>
            <Container>
                <Row className="align-items-center">
                    {/* Column for "Follow Us" social media links. */}
                    <Col md={4} className="mb-3 mb-md-0">
                        <h5 className={styles.footerH5}>Follow Us</h5>
                        <div className="d-flex">
                            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className={`text-light me-3 ${styles.footerA}`}>
                                <FaInstagram size={24} />
                            </a>
                            <a href="https://www.reddit.com/r/cats/s/avvgLwnNSy" target="_blank" rel="noopener noreferrer" className={`text-light ${styles.footerA}`}>
                                <FaReddit size={24} />
                            </a>
                        </div>
                    </Col>
                    {/* Column for "Contact Us" information. */}
                    <Col md={4} className="mb-3 mb-md-0">
                        <h5 className={styles.footerH5}>Contact Us</h5>
                        <p className="mb-1">
                            <a href="https://wa.me/+96176177435" className={`text-light ${styles.footerA}`} target="_blank" rel="noopener noreferrer">
                                <FaWhatsapp size={20} className="me-2" /> +961 76 177 435
                            </a>
                        </p>
                        <p className="mb-0">
                            <a href="mailto:anasanasmtaweh@gmail.com" className={`text-light ${styles.footerA}`}>
                                <FaEnvelope size={20} className="me-2" /> anasanasmtaweh@gmail.com
                            </a>
                        </p>
                    </Col>
                    {/* Column for copyright and developer information. */}
                    <Col md={4} className="text-md-end">
                        <p className="mb-1">
                            &copy; {new Date().getFullYear()} MISHTIKA
                        </p>
                        <p className="mb-0">
                            Developed by{' '}
                            <a href="https://github.com/Anasmtaweh" target="_blank" rel="noopener noreferrer" className={`text-light ${styles.footerA}`}>
                                <FaGithub size={18} className="me-1" /> Anas Mtaweh
                            </a>
                        </p>
                    </Col>
                </Row>
            </Container>
        </footer>
    );
}

export default Footer;



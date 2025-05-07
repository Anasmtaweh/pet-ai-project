import React from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { FaInstagram, FaReddit, FaWhatsapp, FaEnvelope, FaGithub } from 'react-icons/fa'; // Added FaGithub
import styles from './Footer.module.css'; // Import the CSS Module

function Footer() {
    return (
        <footer className={styles.footer}> {/* Apply the CSS Module class */}
            <Container>
                <Row className="align-items-center"> {/* Added align-items-center for better vertical alignment */}
                    <Col md={4} className="mb-3 mb-md-0"> {/* Added margin bottom for mobile */}
                        <h5 className={styles.footerH5}>Follow Us</h5> {/* Apply the CSS Module class */}
                        <div className="d-flex">
                            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className={`text-light me-3 ${styles.footerA}`}> {/* Apply the CSS Module class */}
                                <FaInstagram size={24} />
                            </a>
                            <a href="https://www.reddit.com/r/cats/s/avvgLwnNSy" target="_blank" rel="noopener noreferrer" className={`text-light ${styles.footerA}`}> {/* Apply the CSS Module class */}
                                <FaReddit size={24} />
                            </a>
                        </div>
                    </Col>
                    <Col md={4} className="mb-3 mb-md-0"> {/* Added margin bottom for mobile */}
                        <h5 className={styles.footerH5}>Contact Us</h5> {/* Apply the CSS Module class */}
                        <p className="mb-1"> {/* Reduced margin for tighter spacing */}
                            <a href="https://wa.me/+96176177435" className={`text-light ${styles.footerA}`} target="_blank" rel="noopener noreferrer"> {/* Apply the CSS Module class */}
                                <FaWhatsapp size={20} className="me-2" /> +961 76 177 435
                            </a>
                        </p>
                        <p className="mb-0"> {/* Reduced margin */}
                            <a href="mailto:anasanasmtaweh@gmail.com" className={`text-light ${styles.footerA}`}> {/* Updated placeholder email */}
                                <FaEnvelope size={20} className="me-2" /> anasanasmtaweh@gmail.com
                            </a>
                        </p>
                    </Col>
                    <Col md={4} className="text-md-end"> {/* Align text to the right on medium screens and up */}
                        <p className="mb-1"> {/* Reduced margin */}
                            &copy; {new Date().getFullYear()} MISHTIKA
                        </p>
                        <p className="mb-0"> {/* Reduced margin */}
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


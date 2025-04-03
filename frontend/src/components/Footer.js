import React from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { FaInstagram, FaReddit, FaWhatsapp, FaEnvelope } from 'react-icons/fa'; // Import icons
import styles from './Footer.module.css'; // Import the CSS Module

function Footer() {
    return (
        <footer className={styles.footer}> {/* Apply the CSS Module class */}
            <Container>
                <Row>
                    <Col md={4}>
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
                    <Col md={4}>
                        <h5 className={styles.footerH5}>Contact Us</h5> {/* Apply the CSS Module class */}
                        <p>
                        <a href="https://wa.me/+96176177435" className={`text-light ${styles.footerA}`} target="_blank" rel="noopener noreferrer"> {/* Apply the CSS Module class */}
                            <FaWhatsapp size={20} className="me-2" /> +961 76 177 435
                        </a>
                        </p>
                        <p>
                            <a href="mailto:YOUR_EMAIL@example.com" className={`text-light ${styles.footerA}`}> {/* Apply the CSS Module class */}
                                <FaEnvelope size={20} className="me-2" /> YOUR_EMAIL@example.com
                            </a>
                        </p>
                    </Col>
                    <Col md={4}>
                        <p>&copy; {new Date().getFullYear()} MISHTIKA</p>
                    </Col>
                </Row>
            </Container>
        </footer>
    );
}

export default Footer;

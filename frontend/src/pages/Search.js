import React, { useState } from 'react';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './Search.module.css';

const SearchPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSearchResults([]);

        try {
            // Replace with your SearX instance URL
            const searxUrl = 'https://searx.example.com/'; 
            const response = await fetch(`${searxUrl}?q=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setSearchResults(data.results);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className={styles.searchContainer}>
            <h1 className={styles.searchTitle}>Search</h1>
            <Form onSubmit={handleSearch}>
                <Form.Group className="mb-3" controlId="formBasicSearch">
                    <Form.Control
                        type="text"
                        placeholder="Enter your search term"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        required
                    />
                </Form.Group>
                <Button className={styles.searchButton} variant="primary" type="submit">
                    Search
                </Button>
            </Form>
            {loading && <p>Searching...</p>}
            {error && <p className="text-danger">{error}</p>}
            {searchResults.length > 0 && (
                <ul className={styles.searchResults}>
                    {searchResults.map((result, index) => (
                        <li key={index}>
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                                {result.title}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </Container>
    );
};

export default SearchPage;

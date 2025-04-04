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
            // Updated to your EC2 IP and SearX endpoint
            const searxUrl = 'http://51.21.213.59:8888/search';
            const response = await fetch(
                `${searxUrl}?q=${encodeURIComponent(searchTerm)}&format=json`
            );
            
            if (!response.ok) {
                throw new Error(`SearX API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Verify the results structure
            if (!data.results) {
                throw new Error('Invalid response format from SearX');
            }
            
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
            {error && <p className="text-danger">Error: {error}</p>}
            {searchResults.length > 0 && (
                <ul className={styles.searchResults}>
                    {searchResults.map((result, index) => (
                        <li key={index}>
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                                {result.title || 'Untitled result'}
                            </a>
                            {result.content && (
                                <p className={styles.resultSnippet}>{result.content}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Container>
    );
};

export default SearchPage;
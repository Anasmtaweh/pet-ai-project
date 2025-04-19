import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row'; // Import Row
import Col from 'react-bootstrap/Col'; // Import Col
import styles from './AIChat.module.css';

function AIChat() {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userPets, setUserPets] = useState([]); // State for user's pets
    const [selectedPetId, setSelectedPetId] = useState(''); // State for selected pet ID
    const token = localStorage.getItem('token'); // Get token for user ID

    // Fetch user's pets on component mount
    useEffect(() => {
        document.title = "MISHTIKA - AI Chat"; // Set page title

        const fetchPets = async () => {
            if (!token) {
                setError("User not logged in.");
                return;
            }
            try {
                const decodedToken = JSON.parse(atob(token.split('.')[1]));
                const ownerId = decodedToken.id;
                const response = await axios.get(`https://mishtika.duckdns.org/pets/owner/${ownerId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUserPets(response.data || []); // Ensure it's an array
            } catch (err) {
                // Don't show error if it's just 404 (no pets found)
                if (err.response?.status !== 404) {
                    console.error('Error fetching pets:', err);
                    setError('Could not fetch your pets.');
                }
                setUserPets([]); // Set to empty array on error or no pets
            }
        };

        fetchPets();
    }, [token]); // Dependency array includes token

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        setLoading(true);
        setError(null);

        // --- Prepare the prompt ---
        let finalQuestion = userInput;
        const selectedPet = userPets.find(pet => pet._id === selectedPetId);

        if (selectedPet) {
            // Construct the prompt with pet details
            finalQuestion = `
Regarding my pet:
Name: ${selectedPet.name}
Age: ${selectedPet.ageYears} years, ${selectedPet.ageMonths} months
Species: ${selectedPet.species}
Breed: ${selectedPet.breed}
Medical Info: ${selectedPet.medicalInfo || 'None provided.'}

My question is: ${userInput}
            `.trim(); // Use trim to remove leading/trailing whitespace
        }
        // --- End prompt preparation ---


        // Add user message to UI (show only the typed input)
        const userMessageForUI = { role: 'user', content: userInput };
        // Keep track of messages including the full context sent to AI
        const currentMessages = [...messages, userMessageForUI];
        setMessages(currentMessages);
        setUserInput(''); // Clear input field
        setSelectedPetId(''); // Optionally clear pet selection after sending

        try {
            // Send the potentially modified question to the backend
            const response = await axios.post('https://mishtika.duckdns.org/gpt/ask', { question: finalQuestion });
            const aiResponse = { role: 'assistant', content: response.data.answer };
            setMessages([...currentMessages, aiResponse]); // Add AI response
        } catch (error) {
            console.error("Error asking AI:", error);
            setError(error.response?.data?.error || error.message || "An error occurred asking the AI.");
            // Optionally add an error message to the chat
            const errorMessage = { role: 'assistant', content: `Sorry, I encountered an error. ${error.message}` };
            setMessages([...currentMessages, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className={styles.aichatContainer}>
            <h1 className={styles.aichatTitle}>AI Chat</h1>
            <div className={styles.chatbox}>
                {messages.map((message, index) => (
                    <div key={index} className={message.role === 'user' ? styles.userMessage : styles.aiMessage}>
                        <span className={styles.messageRole}>{message.role === 'user' ? 'You' : 'AI'}: </span> {message.content}
                    </div>
                ))}
                {loading && <div className={styles.loadingIndicator}>Thinking...</div>}
            </div>

            {error && <p className={`text-danger ${styles.errorMessage}`}>{error}</p>}

            <Form onSubmit={handleSubmit} className={styles.inputForm}>
                <Row className="w-100 align-items-center"> {/* Use Row for layout */}
                    <Col xs={12} md={4} className="mb-2 mb-md-0"> {/* Column for dropdown */}
                        <Form.Select
                            aria-label="Select Pet"
                            value={selectedPetId}
                            onChange={(e) => setSelectedPetId(e.target.value)}
                            className={styles.petSelect} // Add specific class if needed
                        >
                            <option value="">Select a pet (Optional)</option>
                            {userPets.length > 0 ? (
                                userPets.map((pet) => (
                                    <option key={pet._id} value={pet._id}>
                                        {pet.name} ({pet.species})
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>No pets found</option>
                            )}
                        </Form.Select>
                    </Col>
                    <Col xs={12} md={6}> {/* Column for text input */}
                        <Form.Control
                            type="text"
                            placeholder="Type your message..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            required
                            className={styles.inputField} // Add specific class if needed
                        />
                    </Col>
                    <Col xs={12} md={2} className="d-grid"> {/* Column for button */}
                        <Button className={styles.sendButton} variant="primary" type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send'}
                        </Button>
                    </Col>
                </Row>
            </Form>
        </Container>
    );
}

export default AIChat;

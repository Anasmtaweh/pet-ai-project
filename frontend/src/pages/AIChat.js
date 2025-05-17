import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import styles from './AIChat.module.css';

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    document.title = "MISHTIKA - AI Chat";

    const fetchPets = async () => {
      if (!token) {
        // setError("User not logged in."); // Consider if this should be an error or if chat is usable without pets
        return;
      }
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const ownerId = decodedToken.id;
        const response = await axios.get(`https://mishtika.duckdns.org/pets/owner/${ownerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserPets(response.data || []);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Error fetching pets:', err);
          // setError('Could not fetch your pets.'); // Consider if this error should block chat
        }
        setUserPets([]);
      }
    };

    fetchPets();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setLoading(true);
    setError(null);

    const selectedPet = userPets.find(pet => pet._id === selectedPetId);

    // This is the actual question content to be sent to the AI, potentially with pet context
    const currentQuestionForAI = selectedPet
      ? `
Regarding my pet:
Name: ${selectedPet.name}
Age: ${selectedPet.ageYears} years, ${selectedPet.ageMonths} months
Species: ${selectedPet.species}
Breed: ${selectedPet.breed}
Medical Info: ${selectedPet.medicalInfo || 'None provided.'}

My question is: ${userInput}
      `.trim()
      : userInput;

    // Message object for UI (shows the raw user input)
    const userMessageForUI = { role: 'user', content: userInput };

    // History for API (all messages *before* this new one)
    const historyForAPI = [...messages];

    // Update UI immediately with user's raw message
    const updatedMessagesWithUser = [...historyForAPI, userMessageForUI];
    setMessages(updatedMessagesWithUser);

    setUserInput('');
    // setSelectedPetId(''); // Decide if you want to clear pet selection after each message

    try {
      // Send the current question AND the history to the backend
      const response = await axios.post('https://mishtika.duckdns.org/gpt/ask', { // <<<<< CHECK THIS URL
        question: currentQuestionForAI, // Send the current question
        history: historyForAPI          // Send the history up to the previous turn
      });

      const aiResponse = { role: 'assistant', content: response.data.answer };
      // Append AI response to the messages already updated with user's input
      setMessages(prevMessages => [...prevMessages, aiResponse]);

    } catch (error) {
      console.error("Error asking AI:", error);
      const errorMessageContent = error.response?.data?.error || error.message || "An error occurred asking the AI.";
      setError(errorMessageContent); // Set error state for display as a general error message

      // Add an error message to the chat UI as an AI response
      const errorMessageForChat = { role: 'assistant', content: `Sorry, I encountered an error: ${errorMessageContent}` };
      setMessages(prevMessages => [...prevMessages, errorMessageForChat]);
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
        <Row className="w-100 align-items-center">
          <Col xs={12} md={4} className="mb-2 mb-md-0">
            <Form.Select
              aria-label="Select Pet"
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className={styles.petSelect}
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
          <Col xs={12} md={6}>
            <Form.Control
              type="text"
              placeholder="Type your message..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              required
              className={styles.inputField}
            />
          </Col>
          <Col xs={12} md={2} className="d-grid">
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



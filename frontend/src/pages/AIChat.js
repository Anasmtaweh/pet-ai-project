import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import styles from './AIChat.module.css';

// AIChat component for interacting with an AI assistant.
function AIChat() {
  // State for storing chat messages (user and AI).
  const [messages, setMessages] = useState([]);
  // State for the user's current input.
  const [userInput, setUserInput] = useState('');
  // State to indicate if the AI is currently processing a request.
  const [loading, setLoading] = useState(false);
  // State for storing any errors that occur.
  const [error, setError] = useState(null);
  // State for storing the user's pets, to provide context to the AI.
  const [userPets, setUserPets] = useState([]);
  // State for the ID of the pet selected to provide context.
  const [selectedPetId, setSelectedPetId] = useState('');
  // Retrieves the authentication token from local storage.
  const token = localStorage.getItem('token');

  // Effect hook to set the document title and fetch user's pets on component mount.
  useEffect(() => {
    document.title = "MISHTIKA - AI Chat";

    // Fetches the user's pets to allow them to be selected for chat context.
    const fetchPets = async () => {
      if (!token) {
        return;
      }
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const ownerId = decodedToken.id;
        // API call to get pets owned by the current user.
        const response = await axios.get(`https://mishtika.duckdns.org/pets/owner/${ownerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserPets(response.data || []);
      } catch (err) {
        if (err.response?.status !== 404) { // Don't show error if user simply has no pets.
          console.error('Error fetching pets:', err);
        }
        setUserPets([]);
      }
    };

    fetchPets();
  }, [token]); // Dependency array includes token.

  // Handles the submission of the user's message.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return; // Do nothing if input is empty.

    setLoading(true);
    setError(null);

    // Finds the selected pet to include its details in the AI prompt.
    const selectedPet = userPets.find(pet => pet._id === selectedPetId);

    // Constructs the question for the AI, including pet context if a pet is selected.
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

    // Message object for displaying the user's raw input in the UI.
    const userMessageForUI = { role: 'user', content: userInput };

    // Prepares the conversation history to be sent to the API (all messages before the current one).
    const historyForAPI = [...messages];

    // Updates the UI immediately with the user's message.
    const updatedMessagesWithUser = [...historyForAPI, userMessageForUI];
    setMessages(updatedMessagesWithUser);

    setUserInput(''); // Clears the input field.

    try {
      // API call to the backend's GPT endpoint.
      const response = await axios.post('https://mishtika.duckdns.org/gpt/ask', {
        question: currentQuestionForAI, // Sends the potentially context-enriched question.
        history: historyForAPI          // Sends the conversation history.
      });

      // Creates the AI's response message object.
      const aiResponse = { role: 'assistant', content: response.data.answer };
      // Appends the AI's response to the chat messages.
      setMessages(prevMessages => [...prevMessages, aiResponse]);

    } catch (error) {
      console.error("Error asking AI:", error);
      const errorMessageContent = error.response?.data?.error || error.message || "An error occurred asking the AI.";
      setError(errorMessageContent); // Sets a general error message for display.

      // Adds an error message to the chat UI, appearing as an AI response.
      const errorMessageForChat = { role: 'assistant', content: `Sorry, I encountered an error: ${errorMessageContent}` };
      setMessages(prevMessages => [...prevMessages, errorMessageForChat]);
    } finally {
      setLoading(false); // Resets the loading state.
    }
  };

  // Renders the AI chat interface.
  return (
    <Container className={styles.aichatContainer}>
      <h1 className={styles.aichatTitle}>AI Chat</h1>
      {/* Chatbox for displaying messages */}
      <div className={styles.chatbox}>
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? styles.userMessage : styles.aiMessage}>
            <span className={styles.messageRole}>{message.role === 'user' ? 'You' : 'AI'}: </span> {message.content}
          </div>
        ))}
        {/* Loading indicator while AI is processing */}
        {loading && <div className={styles.loadingIndicator}>Thinking...</div>}
      </div>

      {/* Displays any general error messages */}
      {error && <p className={`text-danger ${styles.errorMessage}`}>{error}</p>}

      {/* Form for user input, pet selection, and sending messages */}
      <Form onSubmit={handleSubmit} className={styles.inputForm}>
        <Row className="w-100 align-items-center">
          {/* Pet selection dropdown */}
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
          {/* Message input field */}
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
          {/* Send button */}
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




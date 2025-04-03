import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import styles from './AIChat.module.css';

function AIChat() {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return; // Prevent empty submissions

        setLoading(true);
        setError(null);

        try {
            const newMessage = { role: 'user', content: userInput };
            setMessages([...messages, newMessage]);
            setUserInput('');

            const response = await axios.post('http://localhost:3001/gpt/ask', { question: userInput });
            const aiResponse = { role: 'assistant', content: response.data.answer };
            setMessages([...messages, newMessage, aiResponse]);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = "MISHTIKA - AI Chat";
    }, []);

    return (
        <Container className={styles.aichatContainer}>
            <h1 className={styles.aichatTitle}>AI Chat</h1>
            <div className={styles.chatbox}>
                {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? styles.userMessage : styles.aiMessage}>
                <span className={styles.messageRole}>{message.role}: </span> {message.content}
            </div>

                ))}
            </div>
            {loading && <p>Thinking...</p>}
            {error && <p className="text-danger">{error}</p>}
            <Form onSubmit={handleSubmit} className={styles.inputForm}>
                <Form.Control
                    type="text"
                    placeholder="Type your message..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    required
                />
                <Button className={styles.sendButton} variant="primary" type="submit">Send</Button>
            </Form>
        </Container>
    );
}

export default AIChat;

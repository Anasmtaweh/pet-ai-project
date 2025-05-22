const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config(); // Ensure environment variables are loaded, especially OPENAI_API_KEY.

// Initialize the OpenAI client with the API key from environment variables.
// This client will be used to make requests to the OpenAI API.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Local in-memory database of pet food products available in Lebanon.
// This data is used by the AI to answer product-specific questions.
const LEBANON_PET_PRODUCTS = {
  cat: [
    {
      brand: 'Royal Canin',
      stores: [
        { name: 'Petriotics', online: true },
        { name: 'Vetomall', online: true },
        { name: 'Buddy Pet Shop', online: true },
      ]
    },
    {
      brand: 'Whiskas',
      stores: [
        { name: 'Carrefour Lebanon', online: true },
        { name: 'Spinneys Lebanon', online: true },
      ]
    },
    {
      brand: 'Hill\'s Science Diet',
      stores: [
        { name: 'Petriotics', online: true },
        { name: 'Vetzone', online: true }
      ]
    }
  ],
  dog: [
    {
      brand: 'Royal Canin',
      stores: [
        { name: 'Petriotics', online: true },
        { name: 'Vetomall', online: true },
        { name: 'Buddy Pet Shop', online: true },
      ]
    },
    {
      brand: 'Pedigree',
      stores: [
        { name: 'Carrefour Lebanon', online: true },
        { name: 'Spinneys Lebanon', online: true }
      ]
    },
    {
      brand: 'Acana',
      stores: [
        { name: 'Petriotics', online: true },
        { name: 'Vetzone', online: true }
      ]
    }
  ]
};

// Route to handle questions sent to the OpenAI GPT model.
// POST /gpt/ask
router.post('/ask', async (req, res) => {
  try {
    // Destructure the question and conversation history from the request body.
    const { question, history = [] } = req.body;

    // Validate the incoming question.
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing question.' });
    }

    // System prompt to guide the AI's behavior and provide context about its role and available data.
    // It instructs the AI on how to respond to pet care questions, product inquiries (using LEBANON_PET_PRODUCTS),
    // and how to handle out-of-scope questions.
    const systemPrompt = `You are a helpful assistant specializing in pet care and products available in Lebanon.
Your primary goal is to answer questions about general pet care, including feeding, health, behavior, and well-being.
**When responding to follow-up questions, carefully consider the entire conversation history, including previous user statements, AI responses, and any specific pet details mentioned, to provide relevant and contextual answers. Try to connect new information from the user to the ongoing topic.**
If a question is specifically about pet products or where to buy them in Lebanon, use the following data to formulate your answer. Present the information clearly, mentioning the brand and the stores where it's available.
Available Pet Products in Lebanon:
${JSON.stringify(LEBANON_PET_PRODUCTS, null, 2)}

If you cannot answer a question based on the provided product data or your general pet care knowledge, say "I don't know".
Only if a question is clearly NOT related to pets, pet care, or pet products, should you respond with: "I can only assist you in pet related questions".
`;

    // Initialize the messages array with the system prompt.
    let messages = [{ role: "system", content: systemPrompt }];

    // Append valid conversation history to the messages array.
    // This provides context to the AI for follow-up questions.
    if (history && Array.isArray(history)) {
        const validHistory = history.filter(
            item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
        );
        messages = messages.concat(validHistory);
    }

    // Add the current user's question to the messages array.
    messages.push({ role: "user", content: question });

    // Make a request to the OpenAI Chat Completions API.
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Specifies the GPT model to use.
        messages: messages,       // The array of messages forming the conversation.
        max_tokens: 250,          // Limits the length of the AI's response.
        temperature: 0.7,         // Controls the randomness/creativity of the response.
    });

    // Extract the AI's answer from the API response.
    const answer = completion.choices[0].message.content.trim();
    // Send the AI's answer back to the client.
    res.json({ answer });

  } catch (error) {
    // Handle errors from the OpenAI API or other issues.
    console.error("Error in /gpt/ask:", error);
    let errorMessage = "Something went wrong processing your question.";
    // Provide more specific error messages if available from the OpenAI API error object.
    if (error instanceof OpenAI.APIError) {
        errorMessage = error.message || "OpenAI API Error";
        if (error.response?.data?.error) {
            errorMessage = error.response.data.error.message;
        } else if (error.status) {
             errorMessage = `OpenAI API Error (Status: ${error.status}): ${error.message}`;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }
    res.status(error.status || 500).json({ error: errorMessage });
  }
});

module.exports = router;

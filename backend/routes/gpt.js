// c:\Users\Anas\M5\pet-ai-project\backend\routes\gpt.js

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config(); // Ensure dotenv is loaded

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Local database of pet food products available in Lebanon
// Using the structure from your 'new' gpt.js as it seems more detailed
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

// POST /gpt/ask
router.post('/ask', async (req, res) => {
  try {
    // Expect 'question' and 'history' from the frontend
    // 'history' should be an array of message objects: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
    const { question, history = [] } = req.body; // Default history to empty array if not provided

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing question.' });
    }

    // --- System Prompt: Include data and instructions for the AI ---
    const systemPrompt = `You are a helpful assistant specializing in pet care and products available in Lebanon.
If the question is not related to pets or pet products, answer "I can only assist you in pet related questions".
If the question is about pet products or where to buy them, use the following data about products and stores in Lebanon to formulate your answer.
Present the information clearly, mentioning the brand and the stores where it's available.
If you don't know the answer based on the provided data or general pet knowledge, say "I don't know".

Available Pet Products in Lebanon:
${JSON.stringify(LEBANON_PET_PRODUCTS, null, 2)}
`;
    // --- End System Prompt ---


    // Construct the messages array for the OpenAI API
    // Start with the system prompt, then add the history, then the current user question
    let messages = [{ role: "system", content: systemPrompt }];

    // Add previous conversation history if provided and valid
    if (history && Array.isArray(history)) {
        // Basic validation for history items
        const validHistory = history.filter(
            item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
        );
        messages = messages.concat(validHistory);
    }

    // Add the current user question
    messages.push({ role: "user", content: question });

    // Optional: Log messages for debugging
    // console.log("Messages sent to OpenAI:", JSON.stringify(messages, null, 2));

    // --- Call OpenAI API with the full conversation history ---
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Or a newer model if available and desired
        messages: messages, // Send the full conversation history
        max_tokens: 250, // Increased max_tokens to allow for longer responses and history
        temperature: 0.7, // Adjust temperature for creativity (0.7 is standard)
    });
    // --- End OpenAI API Call ---

    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });

  } catch (error) {
    console.error("Error in /gpt/ask:", error);
    let errorMessage = "Something went wrong processing your question.";

    // Improved error handling based on OpenAI API errors
    if (error instanceof OpenAI.APIError) {
        errorMessage = error.message || "OpenAI API Error";
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error.message;
        } else if (error.status) {
             errorMessage = `OpenAI API Error (Status: ${error.status}): ${error.message}`;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }

    // Use error.status if available, otherwise default to 500
    res.status(error.status || 500).json({ error: errorMessage });
  }
});

module.exports = router;



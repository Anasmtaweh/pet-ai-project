// c:\Users\Anas\M5\pet-ai-project\backend\routes\gpt.js

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config(); // Ensure dotenv is loaded

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Local database of pet food products available in Lebanon
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
    const { question, history = [] } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing question.' });
    }

    // --- REFINED System Prompt for better follow-up ---
    const systemPrompt = `You are a helpful assistant specializing in pet care and products available in Lebanon.
Your primary goal is to answer questions about general pet care, including feeding, health, behavior, and well-being.
**When responding to follow-up questions, carefully consider the entire conversation history, including previous user statements, AI responses, and any specific pet details mentioned, to provide relevant and contextual answers. Try to connect new information from the user to the ongoing topic.**
If a question is specifically about pet products or where to buy them in Lebanon, use the following data to formulate your answer. Present the information clearly, mentioning the brand and the stores where it's available.
Available Pet Products in Lebanon:
${JSON.stringify(LEBANON_PET_PRODUCTS, null, 2)}

If you cannot answer a question based on the provided product data or your general pet care knowledge, say "I don't know".
Only if a question is clearly NOT related to pets, pet care, or pet products, should you respond with: "I can only assist you in pet related questions".
`;
    // --- End REFINED System Prompt ---

    let messages = [{ role: "system", content: systemPrompt }];

    if (history && Array.isArray(history)) {
        const validHistory = history.filter(
            item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
        );
        messages = messages.concat(validHistory);
    }

    messages.push({ role: "user", content: question }); // 'question' here is currentQuestionForAI from frontend

    // console.log("Messages sent to OpenAI:", JSON.stringify(messages, null, 2)); // For debugging

    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 250, // You might adjust this; longer context might need more output tokens
        temperature: 0.7,
    });

    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });

  } catch (error) {
    console.error("Error in /gpt/ask:", error);
    let errorMessage = "Something went wrong processing your question.";
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


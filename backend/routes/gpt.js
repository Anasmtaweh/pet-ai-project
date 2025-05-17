const express = require('express');
const router = express.Router();
const OpenAI = require("openai");
const config = require('../config/config');

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

// IMPORTANT: Update this object with REAL store names and product availability in Lebanon.
const LEBANON_PET_PRODUCTS = {
    dog_food: [
      {
        brand: "PawPots",
        stores: ["PawPots Online"],
        description: "Fresh, vet-approved dog food made with human-grade ingredients."
      },
      {
        brand: "Royal Canin",
        stores: ["Petriotics", "Vetomall", "Buddy Pet Shop"],
        description: "Tailored nutrition for dogs of all breeds and life stages."
      }
    ],
    cat_food: [
      {
        brand: "Whiskas",
        stores: ["Carrefour Lebanon", "Spinneys Lebanon", "MyKady"],
        description: "Balanced wet and dry food designed to meet cats' nutritional needs."
      },
      {
        brand: "Royal Canin",
        stores: ["Petriotics", "Vetomall", "Buddy Pet Shop"],
        description: "Specialized formulas addressing specific feline health requirements."
      }
    ],
    toys: [
      {
        brand: "KONG",
        stores: ["Petsville", "Petriotics", "Buddy Pet Shop"],
        description: "Durable toys that provide mental and physical stimulation for dogs."
      },
      {
        brand: "Petstages",
        stores: ["Ubuy Lebanon", "Buddy Pet Shop"],
        description: "Innovative toys catering to different stages of pet development."
      }
    ]
  };
  

router.post('/ask', async (req, res) => {
    try {
        // Expect 'question' and 'history' from the frontend
        // 'history' should be an array of message objects: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
        const { question, history } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const systemPrompt = `You are a helpful assistant specializing in pet care and products available in Lebanon. And if the question is not related to pets or pet products answer"I can only assist you in pet related questions" If the question is about pet products, suggest products from the following list, specifying where they can be purchased in Lebanon. If no pet products are mentioned, answer the question directly. If you don't know the answer, say "I don't know".

Lebanon Pet Products: ${JSON.stringify(LEBANON_PET_PRODUCTS)}`;

        // Construct the messages array
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

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages, // Send the full conversation history
            max_tokens: 300, // You might need to adjust this based on history length
            temperature: 0.7,
        });

        const answer = completion.choices[0].message.content.trim();
        res.json({ answer });

    } catch (error) {
        console.error("Error with OpenAI API:", error);
        let errorMessage = "An error occurred.";
        // Better error handling for OpenAI API errors
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


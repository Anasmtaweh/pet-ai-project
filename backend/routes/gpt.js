const express = require('express');
const router = express.Router();
const OpenAI = require("openai");
const config = require('../config/config');

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

// Updated Lebanon Pet Products with real stores and locations
const LEBANON_PET_PRODUCTS = {
    dog_food: [
        {
            brand: "Royal Canin",
            stores: [
                { name: "Petriotics", cities: ["Beirut", "Online"] },
                { name: "Vetomall", cities: ["Beirut", "Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] },
                { name: "Carrefour Lebanon", cities: ["Beirut", "Online"] },
                { name: "Spinneys Lebanon", cities: ["Beirut", "Online"] }
            ],
            description: "Tailored nutrition for dogs of all breeds and life stages."
        },
        {
            brand: "Josera",
            stores: [
                { name: "Petsville", cities: ["Baabda", "Online"] }
            ],
            description: "High-quality German pet food with natural ingredients."
        }
    ],
    cat_food: [
        {
            brand: "Whiskas",
            stores: [
                { name: "Carrefour Lebanon", cities: ["Beirut", "Online"] },
                { name: "Spinneys Lebanon", cities: ["Beirut", "Online"] }
            ],
            description: "Balanced wet and dry food designed to meet cats' nutritional needs."
        },
        {
            brand: "Royal Canin",
            stores: [
                { name: "Petriotics", cities: ["Beirut", "Online"] },
                { name: "Vetomall", cities: ["Beirut", "Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] }
            ],
            description: "Specialized formulas addressing specific feline health requirements."
        }
    ],
    toys: [
        {
            brand: "KONG",
            stores: [
                { name: "Petsville", cities: ["Baabda", "Online"] },
                { name: "Petriotics", cities: ["Beirut", "Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] }
            ],
            description: "Durable toys that provide mental and physical stimulation for dogs."
        },
        {
            brand: "Petstages",
            stores: [
                { name: "Ubuy Lebanon", cities: ["Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] }
            ],
            description: "Innovative toys catering to different stages of pet development."
        }
    ]
};

router.post('/ask', async (req, res) => {
    try {
        const { question, history } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const systemPrompt = `
You are a helpful assistant specializing in pet care and pet products available in Lebanon. If the user asks about pet shops or where to buy pet products in specific cities like Beirut, recommend shops from the following list that match the location. If the question is not related to pets, pet care, or pet products, respond with: "I can only assist you in pet-related questions."

Lebanon Pet Products: ${JSON.stringify(LEBANON_PET_PRODUCTS)}
        `.trim();

        let messages = [{ role: "system", content: systemPrompt }];

        if (history && Array.isArray(history)) {
            const validHistory = history.filter(
                item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
            );
            messages = messages.concat(validHistory);
        }

        messages.push({ role: "user", content: question });

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            max_tokens: 300,
            temperature: 0.7,
        });

        const answer = completion.choices[0].message.content.trim();
        res.json({ answer });

    } catch (error) {
        console.error("Error with OpenAI API:", error);
        let errorMessage = "An error occurred.";
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
        res.status(error.status || 500).json({ error: errorMessage });
    }
});

module.exports = router;

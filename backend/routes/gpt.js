const express = require('express');
const router = express.Router();
const OpenAI = require("openai");
const config = require('../config/config');

// ✅ Correct way to initialize OpenAI in v4
const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

const LEBANON_PET_PRODUCTS = {
    "dog_food": [
        {"brand": "Paws Lebanon", "stores": ["Barcode Vet", "Petio Lebanon"], "description": "High-quality kibble for all breeds."},
        {"brand": "VetPlus", "stores": ["Petio Lebanon", "VetEmporium"], "description": "Veterinarian-recommended dog food."}
    ],
    "cat_food": [
        {"brand": "Whiskas Lebanon", "stores": ["Petio Lebanon", "ZooPlus"], "description": "Popular wet and dry cat food."},
        {"brand": "Royal Canin", "stores": ["Barcode Vet", "ZooPlus"], "description": "Premium cat food for specific needs."}
    ],
    "toys": [
        {"brand": "Kong", "stores": ["Barcode Vet", "Petio Lebanon"], "description": "Durable and interactive dog toys."},
        {"brand": "Petstages", "stores": ["Petio Lebanon", "VetEmporium"], "description": "Variety of cat and dog toys."}
    ],
    // Add more categories as needed...
};

router.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const systemPrompt = `You are a helpful assistant specializing in pet care and products available in Lebanon. If the question is about pet products, suggest products from the following list, specifying where they can be purchased in Lebanon. If no pet products are mentioned, answer the question directly. If you don't know the answer, say "I don't know".

Lebanon Pet Products: ${JSON.stringify(LEBANON_PET_PRODUCTS)}`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
        ];

        // ✅ Correct way to call OpenAI in v4
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            max_tokens: 150,
            temperature: 0.7,
        });

        const answer = completion.choices[0].message.content.trim();
        res.json({ answer });
    } catch (error) {
        console.error("Error with OpenAI API:", error);
        let errorMessage = "An error occurred.";
        if (error.response) {
            errorMessage = error.response.data.error.message; 
        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

module.exports = router;

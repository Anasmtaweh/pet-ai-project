// routes/gpt.js
const express = require('express');
const router = express.Router();
const OpenAI = require("openai");
const config = require('../config/config');

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

const LEBANON_PET_PRODUCTS = {
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
    ]
};

router.post('/ask', async (req, res) => {
    try {
        const { question, history } = req.body;
        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const systemPrompt = `
You are a helpful assistant specializing in pet care and products available in Lebanon.
If the question is about feeding a cat or dog, suggest food brands available in Lebanon.
Do not mention stores or locations. Only suggest products and their descriptions.
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

        let aiContent = completion.choices[0].message.content.trim();

        // --- Post-process to inject store info if products are mentioned ---
        const brands = [...LEBANON_PET_PRODUCTS.cat_food, ...LEBANON_PET_PRODUCTS.dog_food];
        const beirutStores = [];

        for (const product of brands) {
            if (aiContent.toLowerCase().includes(product.brand.toLowerCase())) {
                for (const store of product.stores) {
                    if (store.cities.includes("Beirut")) {
                        beirutStores.push({
                            brand: product.brand,
                            store: store.name
                        });
                    }
                }
            }
        }

        if (beirutStores.length > 0) {
            aiContent += "\n\nHere are stores in or near Beirut where you can find the recommended products:\n";
            const lines = beirutStores.map(bs => `- **${bs.brand}** at **${bs.store}**`);
            aiContent += lines.join("\n");
        }

        res.json({ answer: aiContent });

    } catch (error) {
        console.error("OpenAI Error:", error);
        res.status(500).json({ error: error.message || "An error occurred." });
    }
});

module.exports = router;


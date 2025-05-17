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
            description: "Balanced wet and dry food designed to meet cats' nutritional needs.",
            stores: [
                { name: "Carrefour Lebanon", online: true },
                { name: "Spinneys Lebanon", online: true }
            ]
        },
        {
            brand: "Royal Canin",
            description: "Specialized formulas addressing specific feline health requirements.",
            stores: [
                { name: "Petriotics", online: true },
                { name: "Vetomall", online: true },
                { name: "Buddy Pet Shop", online: true }
            ]
        }
    ],
    dog_food: [
        {
            brand: "Royal Canin",
            description: "Tailored nutrition for dogs of all breeds and life stages.",
            stores: [
                { name: "Petriotics", online: true },
                { name: "Vetomall", online: true },
                { name: "Buddy Pet Shop", online: true },
                { name: "Carrefour Lebanon", online: true },
                { name: "Spinneys Lebanon", online: true }
            ]
        },
        {
            brand: "Josera",
            description: "High-quality German pet food with natural ingredients.",
            stores: [
                { name: "Petsville", online: true }
            ]
        }
    ]
};

// Memory of last mentioned brands to track follow-ups
let lastSuggestedBrands = [];

router.post('/ask', async (req, res) => {
    try {
        const { question, history } = req.body;
        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const lowerQ = question.toLowerCase();

        // === CASE 1: User asks for food advice ===
        const isFoodQuery = /(feed|food|recommend).*(cat|dog|him|her|my pet)/i.test(question);
        const isCat = /cat|kitten/i.test(question);
        const isDog = /dog|puppy/i.test(question);

        if (isFoodQuery) {
            let suggestions = [];
            lastSuggestedBrands = [];

            const products = isDog ? LEBANON_PET_PRODUCTS.dog_food : LEBANON_PET_PRODUCTS.cat_food;

            for (const item of products) {
                lastSuggestedBrands.push(item.brand); // save for follow-up
                const storeList = item.stores.map(store =>
                    `- ${store.name} (${store.online ? "Online store available" : "No online store"})`
                ).join('\n');

                suggestions.push(
                    `**${item.brand}**: ${item.description}\nAvailable at:\n${storeList}`
                );
            }

            return res.json({ answer: suggestions.join('\n\n') });
        }

        // === CASE 2: Follow-up asking "where can I buy them" ===
        const isWhereFollowUp = /(where.*(buy|find|get|available|store)|which.*store)/i.test(lowerQ);
        if (isWhereFollowUp && lastSuggestedBrands.length > 0) {
            let results = [];

            for (const category of Object.values(LEBANON_PET_PRODUCTS)) {
                for (const product of category) {
                    if (lastSuggestedBrands.includes(product.brand)) {
                        const storeList = product.stores.map(store =>
                            `- ${store.name} (${store.online ? "Online store available" : "No online store"})`
                        ).join('\n');
                        results.push(`**${product.brand}** is available at:\n${storeList}`);
                    }
                }
            }

            return res.json({ answer: results.join('\n\n') });
        }

        // === Default fallback to OpenAI ===
        const systemPrompt = `
You are a helpful assistant that suggests pet food products available in Lebanon.
If asked what to feed a cat or dog, recommend suitable products with short descriptions, followed by a list of stores (with online availability noted).
Do NOT include specific locations unless the user explicitly asks "Where are these stores?" or similar.

If the user is asking a general or unrelated question, answer normally.
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
            max_tokens: 500,
            temperature: 0.7,
        });

        const aiContent = completion.choices[0].message.content.trim();
        return res.json({ answer: aiContent });

    } catch (error) {
        console.error("OpenAI Error:", error);
        res.status(500).json({ error: error.message || "An error occurred." });
    }
});

module.exports = router;

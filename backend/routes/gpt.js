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
                { name: "Carrefour Lebanon", cities: ["Beirut", "Online"] },
                { name: "Spinneys Lebanon", cities: ["Beirut", "Online"] }
            ]
        },
        {
            brand: "Royal Canin",
            description: "Specialized formulas addressing specific feline health requirements.",
            stores: [
                { name: "Petriotics", cities: ["Beirut", "Online"] },
                { name: "Vetomall", cities: ["Beirut", "Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] }
            ]
        }
    ],
    dog_food: [
        {
            brand: "Royal Canin",
            description: "Tailored nutrition for dogs of all breeds and life stages.",
            stores: [
                { name: "Petriotics", cities: ["Beirut", "Online"] },
                { name: "Vetomall", cities: ["Beirut", "Online"] },
                { name: "Buddy Pet Shop", cities: ["Byblos", "Online"] },
                { name: "Carrefour Lebanon", cities: ["Beirut", "Online"] },
                { name: "Spinneys Lebanon", cities: ["Beirut", "Online"] }
            ]
        },
        {
            brand: "Josera",
            description: "High-quality German pet food with natural ingredients.",
            stores: [
                { name: "Petsville", cities: ["Baabda", "Online"] }
            ]
        }
    ]
};

function extractRequestedType(question) {
    const lower = question.toLowerCase();
    if (lower.includes("cat")) return "cat_food";
    if (lower.includes("dog")) return "dog_food";
    return null;
}

function isAskingAboutLocation(question) {
    return /where.*(buy|find|located|location|available)/i.test(question);
}

router.post('/ask', async (req, res) => {
    try {
        const { question, history } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({ error: 'Please provide a question.' });
        }

        const petType = extractRequestedType(question);

        let previousAnswer = null;
        if (Array.isArray(history)) {
            const lastAssistantResponse = [...history].reverse().find(msg => msg.role === "assistant");
            if (lastAssistantResponse) previousAnswer = lastAssistantResponse.content;
        }

        // LOCATION FOLLOW-UP
        if (isAskingAboutLocation(question) && previousAnswer) {
            // Extract store names from the previous response
            const allBrands = [...LEBANON_PET_PRODUCTS.cat_food, ...LEBANON_PET_PRODUCTS.dog_food];
            const mentionedShops = [];

            allBrands.forEach(brand => {
                if (previousAnswer.includes(brand.brand)) {
                    brand.stores.forEach(store => {
                        mentionedShops.push({
                            brand: brand.brand,
                            store: store.name,
                            cities: store.cities.filter(c => c !== "Online")
                        });
                    });
                }
            });

            let locationText = `Here are the physical store locations for the previously mentioned products:\n`;
            locationText += mentionedShops.map(s =>
                `- **${s.brand}** at **${s.store}**: ${s.cities.join(", ")}`
            ).join("\n");

            return res.json({ answer: locationText });
        }

        // NORMAL RECOMMENDATION MODE
        const recommendations = petType ? LEBANON_PET_PRODUCTS[petType] : [];

        if (recommendations.length === 0) {
            return res.json({ answer: "Please specify if you're asking about cat or dog food so I can help you better." });
        }

        let responseText = `Here are some recommended ${petType === "cat_food" ? "cat" : "dog"} food products:\n`;

        for (const item of recommendations) {
            responseText += `\n**${item.brand}**: ${item.description}\nAvailable at:\n`;
            for (const store of item.stores) {
                const hasOnline = store.cities.includes("Online");
                responseText += `- ${store.name}${hasOnline ? " (Online store available)" : ""}\n`;
            }
        }

        return res.json({ answer: responseText });

    } catch (error) {
        console.error("OpenAI Error:", error);
        res.status(500).json({ error: error.message || "An error occurred." });
    }
});

module.exports = router;

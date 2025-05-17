const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config();

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

// Extract brands mentioned in last assistant message in the conversation
function extractLastSuggestedBrands(history) {
  const brands = [];

  if (!Array.isArray(history)) return brands;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      const lower = msg.content.toLowerCase();

      for (const category of Object.values(LEBANON_PET_PRODUCTS)) {
        for (const product of category) {
          if (lower.includes(product.brand.toLowerCase())) {
            brands.push(product.brand);
          }
        }
      }

      if (brands.length > 0) break; // stop after finding one matching assistant message
    }
  }

  return [...new Set(brands)];
}

// POST /gpt/ask
router.post('/ask', async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing question.' });
    }

    const lowerQ = question.toLowerCase();
    const lastSuggestedBrands = extractLastSuggestedBrands(history);

    // Simple classification logic
    const isFoodQuery = /(what.*feed|what.*food|can i feed|should i feed|recommend.*food|suggest.*food)/i.test(lowerQ);
    const isWhereFollowUp = /(where.*(buy|find|get|available|store)|which.*store)/i.test(lowerQ);

    const mentionedCat = /cat/i.test(lowerQ);
    const mentionedDog = /dog/i.test(lowerQ);
    let category = null;

    if (mentionedCat) category = 'cat';
    else if (mentionedDog) category = 'dog';

    if (isFoodQuery && category) {
      const foodList = LEBANON_PET_PRODUCTS[category];
      const productDetails = foodList.map(p => {
        const storeList = p.stores.map(s =>
          `- ${s.name} (${s.online ? "Online store available" : "No online store"})`
        ).join('\n');

        return `**${p.brand}**:\nAvailable at:\n${storeList}`;
      }).join('\n\n');

      return res.json({ answer: `Here are some recommended ${category} food products:\n\n${productDetails}` });
    }

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

    // Fallback to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: history.concat({ role: 'user', content: question }),
    });

    const aiMessage = completion.choices[0].message.content;
    res.json({ answer: aiMessage });
  } catch (error) {
    console.error("Error in /gpt/ask:", error);
    res.status(500).json({ error: "Something went wrong processing your question." });
  }
});

module.exports = router;


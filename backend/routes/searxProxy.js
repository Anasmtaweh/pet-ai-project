const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // or use native fetch in Node.js 18+

// Proxy GET /api/search?query=cat+food
router.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.query;
        if (!searchTerm) return res.status(400).json({ error: 'Missing query' });

        const isProductSearch = /(buy|shop|purchase|product|price)/i.test(searchTerm);
        const petQuery = `pet ${searchTerm}`;
        
        const params = new URLSearchParams({
            q: petQuery,
            format: 'json',
            ...(isProductSearch && {
                categories: 'shopping',
                countries: 'lb'
            })
        });

        const searxUrl = `http://13.60.211.189:8080/search?${params}`;
        const response = await fetch(searxUrl);
        const data = await response.json();

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch from SearXNG' });
    }
});

module.exports = router;

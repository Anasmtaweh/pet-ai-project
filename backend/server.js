// c:\Users\Anas\M5\pet-ai-project\backend\server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Keep cors import
const config = require('./config/config');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedules');
const gptRoutes = require('./routes/gpt');
const { version } = require('./package.json'); // Keep version import

const app = express();
const port = 3001; // Using the hardcoded port from your old version

// --- Middleware (Order Matters!) ---

// 1. Body Parsing Middleware
app.use(express.json()); // Keep this for parsing JSON bodies

// 2. Specific CORS Configuration (Replaces simple app.use(cors()))
// Define allowed origins
const allowedOrigins = [
    'http://localhost:3000', // For local development frontend
    'http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com' // Your deployed S3 frontend origin
    // Add other origins if necessary
];
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman) or from allowed list
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`); // Log blocked origins
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allow standard methods
    credentials: true, // Important for sending cookies or Authorization headers
    allowedHeaders: "Content-Type, Authorization, X-Requested-With" // Allow necessary headers
};
// Apply CORS middleware *first*
app.use(cors(corsOptions));
// Handle OPTIONS preflight requests automatically
app.options('*', cors(corsOptions)); // Enable preflight across-the-board
// --- End CORS Configuration ---


// Database connection
mongoose.connect(config.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: version || 'unknown', // Keep fallback for safety
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Routes (Matching your old version - NO authenticateToken middleware here)
app.get('/', (req, res) => {
    res.send('Pet AI Backend Service');
});
app.use('/auth', authRoutes);
app.use('/pets', petRoutes);
app.use('/admin', adminRoutes);
app.use('/schedules', scheduleRoutes);
app.use('/gpt', gptRoutes);
// NOTE: No /activity route as it wasn't in your old version

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});

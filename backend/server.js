// c:\Users\Anas\M5\pet-ai-project\backend\server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Ensure cors is imported
const config = require('./config/config');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedules');
const gptRoutes = require('./routes/gpt');
// const recentActivityRoutes = require('./routes/recentActivity'); // REMOVED - Caused MODULE_NOT_FOUND error
const { authenticateToken } = require('./middleware/authMiddleware'); // Assuming this exists in middleware/authMiddleware.js
const { version } = require('./package.json'); // Assuming package.json is in backend root

const app = express();
const port = process.env.PORT || 3001; // Use environment variable for port if available

// --- CORS Configuration ---
// Define allowed origins
const allowedOrigins = [
    'http://localhost:3000', // For local development frontend
    'http://mishtika-frontend.s3-website.eu-north-1.amazonaws.com' // Your deployed S3 frontend origin
    // Add other origins if necessary (e.g., custom domain if using CloudFront)
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

// --- Middleware (Order Matters!) ---
// 1. Apply CORS middleware *first*
app.use(cors(corsOptions));
// Handle OPTIONS preflight requests automatically
app.options('*', cors(corsOptions)); // Enable preflight across-the-board

// 2. Body Parsing Middleware
app.use(express.json()); // For parsing application/json

// --- Database Connection ---
mongoose.connect(config.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// --- Health Check Route ---
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: version || 'unknown', // Use version from package.json
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// --- Public Routes ---
app.get('/', (req, res) => {
    res.send('Pet AI Backend Service');
});
app.use('/auth', authRoutes); // Login, Signup, Forgot/Reset Password

// --- Protected Routes (Apply authentication middleware) ---
// Make sure authenticateToken middleware exists and works correctly
app.use('/pets', authenticateToken, petRoutes);
app.use('/admin', authenticateToken, adminRoutes); // Assuming admin routes also need auth
app.use('/schedules', authenticateToken, scheduleRoutes);
app.use('/gpt', authenticateToken, gptRoutes);
// app.use('/activity', authenticateToken, recentActivityRoutes); // REMOVED - Caused MODULE_NOT_FOUND error

// --- Error Handling Middleware (Optional but Recommended) ---
// Example: Basic error handler - place AFTER all routes
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    // Send generic error response
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error'
    });
});


// --- Start the Server ---
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});

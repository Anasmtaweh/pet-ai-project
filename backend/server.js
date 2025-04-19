require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedules');
const gptRoutes = require('./routes/gpt');
const { version } = require('./package.json');

const app = express();
const port = 3001;

// Middleware (must come first)
app.use(express.json());
app.use(cors());

// Load proxy route AFTER middleware


// Database connection
mongoose.connect(config.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: version,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Routes
app.get('/', (req, res) => {
    res.send('Pet AI Backend Service');
});
app.use('/auth', authRoutes);
app.use('/pets', petRoutes);
app.use('/admin', adminRoutes);
app.use('/schedules', scheduleRoutes);
app.use('/gpt', gptRoutes);

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});

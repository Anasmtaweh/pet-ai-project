const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config'); // Import config
const authRoutes = require('./routes/auth'); // Import auth routes
const petRoutes = require('./routes/pets'); // Import pet routes
const adminRoutes = require('./routes/admin'); // Import admin routes
const scheduleRoutes = require('./routes/schedules'); // Import schedule routes
const gptRoutes = require('./routes/gpt');
const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
mongoose.connect(config.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Routes
app.get('/', (req, res) => {
    res.send('Hello from the backend!');
});
app.use('/auth', authRoutes); // Use auth routes
app.use('/pets', petRoutes); // Use pet routes
app.use('/admin', adminRoutes); // Use admin routes
app.use('/schedules', scheduleRoutes); // Use schedule routes
app.use('/gpt', gptRoutes); // Add this line
// Add new routes for user management
app.use('/admin/users', adminRoutes);
app.use('/admin/pets', adminRoutes);

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});

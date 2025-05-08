// c:\Users\Anas\Desktop\backend\models\User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'], // Added custom message
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'], // Added custom message
        // minlength is implicitly handled by the regex, but can be kept for clarity if desired
        // minlength: [8, 'Password must be at least 8 characters long'],
        validate: {
            validator: function (v) {
                
                // Only validate complexity if the password is new or modified
                if (!this.isModified('password')) return true;
                

                
                // Password must be at least 8 characters long, include uppercase, lowercase, number, and special character (#, +, - included)
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+\-.])[A-Za-z\d@$!%*?&#+\-.]{8,}$/.test(v);
            },
            // Updated message to be slightly more specific
            message: props => `Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#+-. etc).`
        },
    },
    username: {
        type: String,
        required: [true, 'Username is required'], // Added custom message
        trim: true,
    },
    age: {
        type: Number,
        required: [true, 'Age is required'], // Added custom message
        min: [13, 'Age must be at least 13'],
        max: [120, 'Age must be less than 120'],
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Hash the password before saving the user
userSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next(); // <-- Important: Use return next()

    try {
        const salt = await bcrypt.genSalt(10); // Generate salt
        this.password = await bcrypt.hash(this.password, salt); // Hash password
        next();
    } catch (error) {
        next(error); // Pass error to Mongoose
    }
});

const User = mongoose.model('User', userSchema, 'users'); // Explicitly set collection name if needed

module.exports = User;

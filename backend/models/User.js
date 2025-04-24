// c:\Users\Anas\M5\pet-ai-project\backend\models\User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Password must be at least 8 characters long'],
        validate: {
            validator: function (v) {
                // --- UPDATED REGEX ---
                // Password must contain:
                // - at least one lowercase letter
                // - at least one uppercase letter
                // - at least one number
                // - at least one special character from the set @$!%*?&#+-. (DOT INCLUDED)
                // - be at least 8 characters long
                // - contain only allowed characters (letters, digits, specified special chars including DOT)
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+-.] )[A-Za-z\d@$!%*?&#+-.] {8,}$/.test(v);
                // --- END UPDATED REGEX ---
            },
            // Updated message to include the dot
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, one special character (@$!%*?&#+-.), and be at least 8 characters long.',
        },
    },
    username: {
        type: String,
        required: true,
        trim: true,
    },
    age: {
        type: Number,
        required: true,
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
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

// Hash the password before saving the user
userSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    // Use isModified to prevent rehashing if other fields are updated
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error); // Pass error to Mongoose
    }
});


const User = mongoose.model('User', userSchema, 'users');

module.exports = User;

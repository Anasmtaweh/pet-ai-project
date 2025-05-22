const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

// Middleware to authenticate users and ensure they have the 'user' role.
const userMiddleware = (req, res, next) => {
    // Attempt to extract the JWT from the Authorization header.
    const token = req.headers.authorization?.split(' ')[1]; // Get token from Authorization header

    // If no token is found, return an unauthorized error.
    if (!token) {
        return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
        // Verify the token and decode its payload.
        const decoded = jwt.verify(token, jwtSecret.secret);

        // Check if the user's role is 'user'.
        if (decoded.role !== 'user') {
            // If not a 'user', return a forbidden error.
            return res.status(403).json({ message: 'Access denied. User role required' });
        }

        // Attach decoded user information to the request object for use by subsequent handlers.
        req.user = decoded; // Set the decoded token as req.user
        req.user.id = decoded.id; // Set the user id

        // Pass control to the next middleware function in the stack.
        next();
    } catch (error) {
        // If token verification fails (e.g., invalid signature, expired token), return an unauthorized error.
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = userMiddleware;


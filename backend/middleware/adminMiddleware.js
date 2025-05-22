const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

// Middleware to protect routes, ensuring the user is authenticated and has the 'admin' role.
const adminMiddleware = (req, res, next) => {
    // Extract the token from the 'Authorization' header (expected format: "Bearer TOKEN").
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Get token from Authorization header

    // If no token is provided, return a 401 Unauthorized response.
    if (!token) {
        return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
        // Verify the token using the configured JWT secret.
        const decoded = jwt.verify(token, jwtSecret.secret);

        // Check if the decoded token payload includes the 'admin' role.
        if (decoded.role !== 'admin') {
            // If the role is not 'admin', return a 403 Forbidden response.
            return res.status(403).json({ message: 'Access denied. Admin role required' });
        }

        // If the token is valid and the user is an admin, attach the decoded user payload to the request object.
        req.user = decoded; // Set the decoded token as req.user
        req.user.id = decoded.id; // Set the user id (redundant if decoded already has id, but safe)

        // Proceed to the next middleware or route handler.
        next();
    } catch (error) {
        // If token verification fails (e.g., invalid signature, expired), return a 401 Unauthorized response.
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = adminMiddleware;


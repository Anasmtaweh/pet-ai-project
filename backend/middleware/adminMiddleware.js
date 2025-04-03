const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

const adminMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Get token from Authorization header

    if (!token) {
        return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret.secret);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required' });
        }
        req.user = decoded; // Set the decoded token as req.user
        req.user.id = decoded.id; // Set the user id
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = adminMiddleware;

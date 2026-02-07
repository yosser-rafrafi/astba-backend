const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Check if user has admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    next();
};

// Check if user has management permissions (formateur, Responsable, or admin)
const requireFormateur = (req, res, next) => {
    const authorizedRoles = ['formateur', 'admin', 'Responsable'];
    if (!authorizedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Staff role required.' });
    }
    next();
};

// Check if user has specific roles
const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access denied. Required roles: ${roles.join(', ')}`
            });
        }
        next();
    };
};

module.exports = {
    authenticate,
    requireAdmin,
    requireFormateur,
    requireRoles
};

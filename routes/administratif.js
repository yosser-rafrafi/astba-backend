const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Formation = require('../models/Formation');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Level = require('../models/Level');
const Certificate = require('../models/Certificate');
const { authenticate, requireAdmin, requireFormateur } = require('../middleware/auth');

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/formateurs
// @desc    Get only formateurs
// @access  Private (Admin or Responsable)
router.get('/formateurs', authenticate, requireFormateur, async (req, res) => {
    try {
        const formateurs = await User.find({ role: 'formateur' }).select('-password').sort({ name: 1 });
        res.json({ users: formateurs });
    } catch (error) {
        console.error('Get formateurs error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/users
// @desc    Create new user profile
// @access  Private (Admin only)
router.post('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        user = new User({ name, email, password, role });
        await user.save();

        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        console.error('Create user error:', error);

        // Handle Mongoose Validation Errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }

        // Handle Duplicate Email Error (MongoError code 11000)
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà.' });
        }

        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user profile
// @access  Private (Admin only)
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;

        await user.save();
        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Update user error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }

        if (error.code === 11000) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre utilisateur.' });
        }

        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/history/:userId
// @desc    Get full history of formations and attendance per user
// @access  Private (Admin only)
router.get('/history/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const attendances = await Attendance.find({ participant: req.params.userId })
            .populate({
                path: 'session',
                populate: [
                    { path: 'formation', select: 'title' },
                    { path: 'level', select: 'order title' }
                ]
            })
            .sort({ createdAt: -1 });

        res.json({ history: attendances });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/certification/eligible/:userId/:formationId
// @desc    Check if user is eligible for certification (All levels completed + All sessions attended)
// @access  Private (Admin only)
router.get('/certification/eligible/:userId/:formationId', authenticate, requireAdmin, async (req, res) => {
    try {
        // 1. Get all levels for this formation
        const levels = await Level.find({ formation: req.params.formationId });
        if (levels.length === 0) return res.json({ eligible: false, reason: 'La formation n\'a pas encore de niveaux définis.' });

        // 2. Get all sessions for this formation
        const sessions = await Session.find({ formation: req.params.formationId });
        if (sessions.length === 0) return res.status(400).json({ eligible: false, reason: 'Formation has no sessions' });

        // 3. Get all present attendance for this user in this formation
        const attendances = await Attendance.find({
            participant: req.params.userId,
            status: { $in: ['present', 'late'] }
        }).populate('session');

        const attendedSessionIds = attendances
            .filter(a => a.session?.formation?.toString() === req.params.formationId)
            .map(a => a.session._id.toString());

        // Check if all sessions were attended
        const sessionIds = sessions.map(s => s._id.toString());
        const allAttended = sessionIds.every(id => attendedSessionIds.includes(id));

        if (!allAttended) {
            return res.json({
                eligible: false,
                reason: 'All sessions must be attended',
                totalSessions: sessionIds.length,
                attendedCount: attendedSessionIds.length
            });
        }

        res.json({ eligible: true, message: 'User is eligible for certification' });
    } catch (error) {
        console.error('Check eligibility error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/certification/generate
// @desc    Generate certificate
// @access  Private (Admin only)
router.post('/certification/generate', authenticate, requireAdmin, async (req, res) => {
    try {
        const { userId, formationId } = req.body;

        const existing = await Certificate.findOne({ user: userId, formation: formationId });
        if (existing) {
            return res.status(400).json({ error: 'Certificate already generated', certificate: existing });
        }

        const certificate = new Certificate({
            user: userId,
            formation: formationId,
            issuedBy: req.user._id
        });

        await certificate.save();
        res.status(201).json({ message: 'Certificate generated successfully', certificate });
    } catch (error) {
        console.error('Generate certificate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

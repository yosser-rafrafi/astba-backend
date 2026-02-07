const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Formation = require('../models/Formation');
const { authenticate, requireFormateur } = require('../middleware/auth');

// @route   GET /api/formations
// @desc    Get all formations
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const formations = await Formation.find()
            .populate('createdBy', 'name email role')
            .sort({ createdAt: -1 });

        res.json({ formations });
    } catch (error) {
        console.error('Get formations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/formations/assigned
// @desc    Get formations assigned to or created by the logged-in formateur
// @access  Private (Formateur/Admin only)
router.get('/assigned', authenticate, requireFormateur, async (req, res) => {
    try {
        const Session = require('../models/Session');

        // 1. Get formations where user is the formateur in a session
        const sessions = await Session.find({ formateur: req.user._id });
        const assignedFromSessions = sessions.map(s => s.formation?.toString()).filter(id => id);

        // 2. Get formations (Assigned via Session OR Created by this user)
        const formations = await Formation.find({
            $or: [
                { _id: { $in: assignedFromSessions } },
                { createdBy: req.user._id }
            ]
        }).populate('createdBy', 'name email role');

        res.json({ formations });
    } catch (error) {
        console.error('Get assigned formations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/formations/:id
// @desc    Get single formation
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
    try {
        const formation = await Formation.findById(req.params.id)
            .populate('createdBy', 'name email role');

        if (!formation) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        res.json({ formation });
    } catch (error) {
        console.error('Get formation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/formations
// @desc    Create new formation
// @access  Private (Formateur/Admin only)
router.post('/', [
    authenticate,
    requireFormateur,
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 hour'),
    body('startDate').isISO8601().withMessage('Start date must be a valid date')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, duration, startDate } = req.body;

        const formation = new Formation({
            title,
            description,
            duration,
            startDate,
            createdBy: req.user._id
        });

        await formation.save();

        // Auto-create 4 levels for the new formation
        const Level = require('../models/Level');
        const levels = [];
        for (let i = 1; i <= 4; i++) {
            levels.push({
                formation: formation._id,
                order: i,
                title: `Niveau ${i}`
            });
        }
        await Level.insertMany(levels);

        await formation.populate('createdBy', 'name email role');

        res.status(201).json({
            message: 'Formation created successfully with 4 levels',
            formation
        });
    } catch (error) {
        console.error('Create formation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/formations/:id
// @desc    Update formation
// @access  Private (Formateur/Admin only)
router.put('/:id', [
    authenticate,
    requireFormateur,
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 hour'),
    body('startDate').optional().isISO8601().withMessage('Start date must be a valid date')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const formation = await Formation.findById(req.params.id);

        if (!formation) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        // Update fields
        const { title, description, duration, startDate } = req.body;
        if (title) formation.title = title;
        if (description) formation.description = description;
        if (duration) formation.duration = duration;
        if (startDate) formation.startDate = startDate;

        await formation.save();
        await formation.populate('createdBy', 'name email role');

        res.json({
            message: 'Formation updated successfully',
            formation
        });
    } catch (error) {
        console.error('Update formation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/formations/:id
// @desc    Delete formation
// @access  Private (Formateur/Admin only)
router.delete('/:id', authenticate, requireFormateur, async (req, res) => {
    try {
        const formation = await Formation.findById(req.params.id);

        if (!formation) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        await Formation.findByIdAndDelete(req.params.id);

        res.json({ message: 'Formation deleted successfully' });
    } catch (error) {
        console.error('Delete formation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/formations/progress/:id
// @route   GET /api/formations/progress/:id/:userId
// @desc    Get participant progress for a formation
// @access  Private
router.get(['/progress/:id', '/progress/:id/:userId'], authenticate, async (req, res) => {
    try {
        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        const formationId = req.params.id;
        const targetUserId = req.params.userId || req.user._id;

        // Security check: Only Formateur/Admin can view others' progress
        if (req.params.userId && req.params.userId !== req.user._id.toString()) {
            if (req.user.role !== 'formateur' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const totalSessions = await Session.find({ formation: formationId });
        const sessionIds = totalSessions.map(s => s._id);

        const attendedAttendance = await Attendance.find({
            session: { $in: sessionIds },
            participant: targetUserId,
            status: { $in: ['present', 'late'] }
        });

        const missedAttendance = await Attendance.find({
            session: { $in: sessionIds },
            participant: targetUserId,
            status: 'absent'
        });

        res.json({
            formationId,
            totalSessions: totalSessions.length,
            attendedSessions: attendedAttendance.length,
            missedSessions: missedAttendance.length,
            remainingSessions: totalSessions.length - attendedAttendance.length - missedAttendance.length,
            progress: totalSessions.length > 0
                ? Math.round((attendedAttendance.length / totalSessions.length) * 100)
                : 0
        });
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/formations/:id/levels
// @desc    Get levels for a formation
// @access  Private
router.get('/:id/levels', authenticate, async (req, res) => {
    try {
        const Level = require('../models/Level');
        const levels = await Level.find({ formation: req.params.id }).sort({ order: 1 });
        res.json({ levels });
    } catch (error) {
        console.error('Get levels error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

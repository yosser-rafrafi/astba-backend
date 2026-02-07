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
            console.error('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, duration, startDate, defaultFormateur } = req.body;

        const formation = new Formation({
            title,
            description,
            duration,
            startDate,
            createdBy: req.user._id,
            defaultFormateur: defaultFormateur || null
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
        const { title, description, duration, startDate, active } = req.body;
        if (title) formation.title = title;
        if (description) formation.description = description;
        if (duration) formation.duration = duration;
        if (startDate) formation.startDate = startDate;
        if (active !== undefined) formation.active = active;
        if (defaultFormateur !== undefined) formation.defaultFormateur = defaultFormateur || null;

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

// @route   GET /api/formations/progress/:id/user/:userId
// @desc    Get progress for a specific user in a formation
// @access  Private (Formateur/Admin or own data)
router.get('/progress/:id/user/:userId', authenticate, async (req, res) => {
    try {
        // Check permissions
        if (req.user._id.toString() !== req.params.userId &&
            req.user.role !== 'formateur' &&
            req.user.role !== 'admin' &&
            req.user.role !== 'Responsable' &&
            req.user.role !== 'responsable') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        const totalSessions = await Session.find({ formation: req.params.id });
        const sessionIds = totalSessions.map(s => s._id);

        const attendedAttendance = await Attendance.find({
            session: { $in: sessionIds },
            participant: req.params.userId,
            status: { $in: ['present', 'late'] }
        });

        res.json({
            formationId: req.params.id,
            userId: req.params.userId,
            totalSessions: totalSessions.length,
            attendedSessions: attendedAttendance.length,
            missedSessions: totalSessions.length - attendedAttendance.length,
            remainingSessions: 0, // Simplified logic
            progress: totalSessions.length > 0
                ? Math.round((attendedAttendance.length / totalSessions.length) * 100)
                : 0
        });
    } catch (error) {
        console.error('Get user progress error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/formations/progress/:id
// @desc    Get participant progress for a specific formation
// @access  Private
router.get('/progress/:id', authenticate, async (req, res) => {
    try {
        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        const totalSessions = await Session.find({ formation: req.params.id });
        const sessionIds = totalSessions.map(s => s._id);

        const attendedAttendance = await Attendance.find({
            session: { $in: sessionIds },
            participant: req.user._id,
            status: { $in: ['present', 'late'] }
        });

        res.json({
            formationId: req.params.id,
            totalSessions: totalSessions.length,
            attendedSessions: attendedAttendance.length,
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

// @route   GET /api/formations/:id/stats
// @desc    Get global stats for a formation (participants, progress)
// @access  Private (Admin/Formateur)
router.get('/:id/stats', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'formateur' && req.user.role !== 'Responsable' && req.user.role !== 'responsable') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        // 1. Get all sessions for this formation
        const sessions = await Session.find({ formation: req.params.id })
            .populate('participants', 'name email');

        const sessionIds = sessions.map(s => s._id);

        if (sessions.length === 0) {
            return res.json({ students: [] });
        }

        // 2. Identify all unique participants enrolled in ANY session
        const enrolledParticipants = new Map();
        sessions.forEach(session => {
            session.participants.forEach(p => {
                if (p && p._id) {
                    enrolledParticipants.set(p._id.toString(), p);
                }
            });
        });

        // 3. Get all attendance records for these sessions
        const attendances = await Attendance.find({
            session: { $in: sessionIds }
        });

        // 4. Aggregate stats
        const studentStats = {};

        // Initialize for all enrolled
        enrolledParticipants.forEach((user, id) => {
            studentStats[id] = {
                user: user,
                attended: 0,
                total: sessions.filter(s => s.participants.some(p => p._id.toString() === id)).length || sessions.length // Default to total sessions if logic fails, but filter is better
            };
        });

        // Process attendance
        attendances.forEach(record => {
            const pId = record.participant.toString();
            // If student is not in enrolled list (maybe removed?), we might skip or add. 
            // Let's add if missing (though unlikely if data integrity is good)
            if (studentStats[pId]) {
                if (record.status === 'present' || record.status === 'late') {
                    studentStats[pId].attended++;
                }
            }
        });

        // Convert to array
        const students = Object.values(studentStats).map(stat => ({
            ...stat,
            progress: stat.total > 0 ? Math.round((stat.attended / stat.total) * 100) : 0
        }));

        res.json({ students });

    } catch (error) {
        console.error('Get formation stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/formations/:id/enroll
// @desc    Enroll a user in ALL sessions of a formation
// @access  Private (Admin/Formateur/Responsable)
router.post('/:id/enroll', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'formateur' && req.user.role !== 'Responsable' && req.user.role !== 'responsable') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const Session = require('../models/Session');

        // Find all sessions for this formation
        const sessions = await Session.find({ formation: req.params.id });

        if (sessions.length === 0) {
            return res.status(404).json({ error: 'No sessions found for this formation' });
        }

        // Add user to all sessions
        const updates = sessions.map(session => {
            if (!session.participants.includes(userId)) {
                session.participants.push(userId);
                return session.save();
            }
            return Promise.resolve();
        });

        await Promise.all(updates);

        res.json({ message: `User enrolled in ${sessions.length} sessions` });

    } catch (error) {
        console.error('Batch enroll error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

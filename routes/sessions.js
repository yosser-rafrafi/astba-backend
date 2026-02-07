const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Session = require('../models/Session');
const Formation = require('../models/Formation');
const { authenticate, requireFormateur } = require('../middleware/auth');

// @route   GET /api/sessions
// @desc    Get all sessions (optionally filter by formation)
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const filter = {};
        if (req.query.formation) {
            filter.formation = req.query.formation;
        }

        const sessions = await Session.find(filter)
            .populate('formation', 'title description duration')
            .populate('formateur', 'name email')
            .populate('participants', 'name email')
            .sort({ date: -1 });

        res.json({ sessions });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/sessions/:id
// @desc    Get single session
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate('formation', 'title description duration')
            .populate('formateur', 'name email')
            .populate('participants', 'name email');

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ session });
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/sessions
// @desc    Create new session
// @access  Private (Formateur/Admin only)
router.post('/', [
    authenticate,
    requireFormateur,
    body('formation').notEmpty().withMessage('Formation is required'),
    body('level').notEmpty().withMessage('Level is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('startTime').notEmpty().withMessage('Start time is required'),
    body('endTime').notEmpty().withMessage('End time is required'),
    body('formateur').notEmpty().withMessage('Formateur is required'),
    body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be at least 1')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { formation, level, date, startTime, endTime, formateur, maxParticipants } = req.body;

        // Verify formation exists
        const formationExists = await Formation.findById(formation);
        if (!formationExists) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        // Auto-enroll students from existing sessions of this formation
        const existingSession = await Session.findOne({ formation }).select('participants');
        const initialParticipants = existingSession ? existingSession.participants : [];

        // Use provided formateur or fall back to formation's default
        const sessionFormateur = formateur || formationExists.defaultFormateur;

        const session = new Session({
            formation,
            level,
            date,
            startTime,
            endTime,
            formateur: sessionFormateur,
            maxParticipants: maxParticipants || 30,
            participants: initialParticipants
        });

        await session.save();
        await session.populate('formation', 'title description duration');
        await session.populate('formateur', 'name email');

        res.status(201).json({
            message: 'Session created successfully',
            session
        });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/sessions/:id
// @desc    Update session
// @access  Private (Formateur/Admin only)
router.put('/:id', [
    authenticate,
    requireFormateur,
    body('date').optional().isISO8601().withMessage('Valid date is required'),
    body('startTime').optional().notEmpty().withMessage('Start time cannot be empty'),
    body('endTime').optional().notEmpty().withMessage('End time cannot be empty')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const session = await Session.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Update fields
        const { level, date, startTime, endTime, maxParticipants } = req.body;
        if (level) session.level = level;
        if (date) session.date = date;
        if (startTime) session.startTime = startTime;
        if (endTime) session.endTime = endTime;
        if (maxParticipants) session.maxParticipants = maxParticipants;

        await session.save();
        await session.populate('formation', 'title description duration');
        await session.populate('formateur', 'name email');
        await session.populate('participants', 'name email');

        res.json({
            message: 'Session updated successfully',
            session
        });
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/sessions/:id
// @desc    Delete session
// @access  Private (Formateur/Admin only)
router.delete('/:id', authenticate, requireFormateur, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        await Session.findByIdAndDelete(req.params.id);

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/sessions/:id/enroll
// @desc    Enroll participant in session
// @access  Private
router.post('/:id/enroll', authenticate, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check if already enrolled
        if (session.participants.includes(req.user._id)) {
            return res.status(400).json({ error: 'Already enrolled in this session' });
        }

        // Check if session is full
        if (session.participants.length >= session.maxParticipants) {
            return res.status(400).json({ error: 'Session is full' });
        }

        session.participants.push(req.user._id);
        await session.save();
        await session.populate('formation', 'title description duration');
        await session.populate('formateur', 'name email');
        await session.populate('participants', 'name email');

        res.json({
            message: 'Enrolled successfully',
            session
        });
    } catch (error) {
        console.error('Enroll error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/sessions/:id/unenroll
// @desc    Unenroll participant from session
// @access  Private
router.post('/:id/unenroll', authenticate, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check if enrolled
        if (!session.participants.includes(req.user._id)) {
            return res.status(400).json({ error: 'Not enrolled in this session' });
        }

        session.participants = session.participants.filter(
            p => p.toString() !== req.user._id.toString()
        );

        await session.save();
        await session.populate('formation', 'title description duration');
        await session.populate('formateur', 'name email');
        await session.populate('participants', 'name email');

        res.json({
            message: 'Unenrolled successfully',
            session
        });
    } catch (error) {
        console.error('Unenroll error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/sessions/missed
// @desc    Get missed sessions for the logged-in participant
// @access  Private
router.get('/missed', authenticate, async (req, res) => {
    try {
        const Attendance = require('../models/Attendance');
        const missedAttendance = await Attendance.find({
            participant: req.user._id,
            status: 'absent'
        }).populate({
            path: 'session',
            populate: { path: 'formation', select: 'title' }
        });

        const missedSessions = missedAttendance.map(a => a.session).filter(s => s !== null);
        res.json({ sessions: missedSessions });
    } catch (error) {
        console.error('Get missed sessions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

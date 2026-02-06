const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const { authenticate, requireFormateur } = require('../middleware/auth');

// @route   GET /api/attendance/session/:sessionId
// @desc    Get attendance records for a session
// @access  Private
router.get('/session/:sessionId', authenticate, async (req, res) => {
    try {
        const attendance = await Attendance.find({ session: req.params.sessionId })
            .populate('participant', 'name email')
            .populate('markedBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({ attendance });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/attendance/participant/:participantId
// @desc    Get attendance records for a participant
// @access  Private
router.get('/participant/:participantId', authenticate, async (req, res) => {
    try {
        // Only allow users to view their own attendance or formateurs/admins to view any
        if (req.user._id.toString() !== req.params.participantId &&
            req.user.role !== 'formateur' &&
            req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const attendance = await Attendance.find({ participant: req.params.participantId })
            .populate('session')
            .populate('markedBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({ attendance });
    } catch (error) {
        console.error('Get participant attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/attendance
// @desc    Mark attendance for a participant
// @access  Private (Formateur/Admin only)
router.post('/', [
    authenticate,
    requireFormateur,
    body('session').notEmpty().withMessage('Session is required'),
    body('participant').notEmpty().withMessage('Participant is required'),
    body('status').isIn(['present', 'absent', 'late']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { session, participant, status } = req.body;

        // Verify session exists
        const sessionExists = await Session.findById(session);
        if (!sessionExists) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check if attendance already exists
        let attendance = await Attendance.findOne({ session, participant });

        if (attendance) {
            // Update existing attendance
            attendance.status = status;
            attendance.markedBy = req.user._id;
            await attendance.save();
        } else {
            // Create new attendance record
            attendance = new Attendance({
                session,
                participant,
                status,
                markedBy: req.user._id
            });
            await attendance.save();
        }

        await attendance.populate('participant', 'name email');
        await attendance.populate('markedBy', 'name email');

        res.status(201).json({
            message: 'Attendance marked successfully',
            attendance
        });
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (Formateur/Admin only)
router.put('/:id', [
    authenticate,
    requireFormateur,
    body('status').isIn(['present', 'absent', 'late']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        attendance.status = req.body.status;
        attendance.markedBy = req.user._id;
        await attendance.save();

        await attendance.populate('participant', 'name email');
        await attendance.populate('markedBy', 'name email');

        res.json({
            message: 'Attendance updated successfully',
            attendance
        });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (Formateur/Admin only)
router.delete('/:id', authenticate, requireFormateur, async (req, res) => {
    try {
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        await Attendance.findByIdAndDelete(req.params.id);

        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

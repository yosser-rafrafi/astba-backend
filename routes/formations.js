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
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 hour')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, duration } = req.body;

        const formation = new Formation({
            title,
            description,
            duration,
            createdBy: req.user._id
        });

        await formation.save();
        await formation.populate('createdBy', 'name email role');

        res.status(201).json({
            message: 'Formation created successfully',
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
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 hour')
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
        const { title, description, duration } = req.body;
        if (title) formation.title = title;
        if (description) formation.description = description;
        if (duration) formation.duration = duration;

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

module.exports = router;

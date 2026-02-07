const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Formation = require('../models/Formation');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Level = require('../models/Level');
const Certificate = require('../models/Certificate');
const { authenticate, requireAdmin, requireRoles } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/users
// @desc    Create new user profile
// @access  Private (Admin only)
router.post('/users', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Security: Responsable can only create students
        if (req.user.role !== 'admin' && role !== 'student') {
            return res.status(403).json({ error: 'Vous ne pouvez créer que des comptes étudiants.' });
        }

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
router.put('/users/:id', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
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
router.get('/history/:userId', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
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
router.get('/certification/eligible/:userId/:formationId', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        // 1. Get all levels for this formation
        const levels = await Level.find({ formation: req.params.formationId });
        if (levels.length === 0) return res.status(404).json({ eligible: false, reason: 'Formation has no levels defined' });

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
router.post('/certification/generate', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
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

// @route   GET /api/admin/stats
// @desc    Get global statistics
// @access  Private (Admin only)
router.get('/stats', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const pendingUsers = await User.countDocuments({ status: 'pending' });
        const formations = await Formation.countDocuments();
        const certificates = await Certificate.countDocuments();

        res.json({
            users: { total: totalUsers, pending: pendingUsers },
            formations,
            certificates
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/stats/charts
// @desc    Get chart data: formation distribution & platform activity
// @access  Private (Admin only)
router.get('/stats/charts', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        // 1. Formation distribution: participants count per formation (with formation colors & patterns)
        const FORMATION_PALETTE = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#0d9488', '#2563eb', '#7c3aed', '#be185d'];
        const formations = await Formation.find({ active: true }).select('title color pattern');
        const formationDistribution = { labels: [], values: [], colors: [], patterns: [] };

        for (let i = 0; i < formations.length; i++) {
            const f = formations[i];
            const sessions = await Session.find({ formation: f._id });
            const uniqueParticipants = new Set();
            sessions.forEach(s => {
                (s.participants || []).forEach(p => uniqueParticipants.add(p.toString()));
            });
            formationDistribution.labels.push(f.title);
            formationDistribution.values.push(uniqueParticipants.size);
            formationDistribution.colors.push(f.color || FORMATION_PALETTE[i % FORMATION_PALETTE.length]);
            formationDistribution.patterns.push(f.pattern || 'dots');
        }

        // 2. Platform activity: sessions count per month (last 6 months)
        const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const now = new Date();
        const platformActivity = { labels: [], values: [] };

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

            const count = await Session.countDocuments({
                date: { $gte: start, $lte: end }
            });

            platformActivity.labels.push(monthLabels[d.getMonth()]);
            platformActivity.values.push(count);
        }

        res.json({
            formationDistribution,
            platformActivity
        });
    } catch (error) {
        console.error('Get charts stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (Approve, Suspend, etc.)
// @access  Private (Admin only)
router.put('/users/:id/status', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'suspended', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Status updated successfully', user });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/certification/download/:id
// @desc    Download certificate PDF
// @access  Private (Admin & Responsable)
router.get('/certification/download/:id', authenticate, requireRoles('admin', 'Responsable', 'responsable'), async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id)
            .populate('user')
            .populate('formation');

        if (!certificate) return res.status(404).json({ error: 'Certificate not found' });

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Certificat-${certificate.certificateId}.pdf`);

        doc.pipe(res);

        // --- PDF DESIGN ---
        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('ASTBA FORMATION', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text('Académie des Sciences et Technologies', { align: 'center' });
        doc.moveDown(2);

        // Title
        doc.rect(50, 150, 742, 2).fill('#334155'); // Decorative line
        doc.moveDown(2);
        doc.fontSize(30).fillColor('#1e293b').font('Helvetica-Bold').text('CERTIFICAT DE RÉUSSITE', { align: 'center' });
        doc.moveDown();

        // Body
        doc.fontSize(16).font('Helvetica').fillColor('black').text('Ce certificat est fièrement décerné à :', { align: 'center' });
        doc.moveDown();

        doc.fontSize(28).font('Helvetica-Bold').fillColor('#2563eb').text(certificate.user.name.toUpperCase(), { align: 'center' });
        doc.moveDown();

        doc.fontSize(16).font('Helvetica').fillColor('black').text('Pour avoir validé avec succès tous les niveaux de la formation :', { align: 'center' });
        doc.moveDown();

        doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text(certificate.formation.title, { align: 'center' });
        doc.moveDown(3);

        // Footer / Signature
        const date = new Date(certificate.issuedAt).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        doc.fontSize(12).font('Helvetica').text(`Fait à Tunis, le ${date}`, 100, 450);

        doc.fontSize(12).font('Helvetica-Bold').text('Le Responsable de Formation', 550, 450);
        // Placeholder for signature
        doc.fontSize(10).font('Helvetica-Oblique').text('(Signature numérique)', 550, 500);

        doc.rect(50, 520, 742, 2).fill('#334155'); // Bottom line
        doc.fontSize(9).text(`ID Certificat: ${certificate.certificateId}`, 50, 530, { align: 'center', color: 'gray' });

        doc.end();

    } catch (error) {
        console.error('Download PDF error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

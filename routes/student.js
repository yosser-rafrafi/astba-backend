const express = require('express');
const router = express.Router();
const Formation = require('../models/Formation');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Level = require('../models/Level');
const Certificate = require('../models/Certificate');
const { authenticate } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// @route   GET /api/student/dashboard
// @desc    Get dashboard data for the logged-in student
// @access  Private (Student)
router.get('/dashboard', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Find all formations where the student is a participant
        // We find sessions where the student is enrolled
        const sessions = await Session.find({ participants: userId })
            .populate('formation')
            .populate('level')
            .populate('formateur', 'name');

        // Get unique formations
        const formationMap = new Map();
        sessions.forEach(s => {
            if (s.formation) {
                formationMap.set(s.formation._id.toString(), s.formation);
            }
        });

        const formations = Array.from(formationMap.values());
        const resultFormations = [];

        // 2. For each formation, calculate progress and level details
        for (const formation of formations) {
            const formationSessions = await Session.find({ formation: formation._id }).sort({ date: 1 });
            const sessionIds = formationSessions.map(s => s._id);

            const userAttendance = await Attendance.find({
                participant: userId,
                session: { $in: sessionIds }
            });

            const attendanceMap = new Map();
            userAttendance.forEach(a => attendanceMap.set(a.session.toString(), a.status));

            const attendedCount = userAttendance.filter(a => ['present', 'late'].includes(a.status)).length;
            const progress = formationSessions.length > 0
                ? Math.round((attendedCount / formationSessions.length) * 100)
                : 0;

            // Level details
            const levels = await Level.find({ formation: formation._id }).sort({ order: 1 });
            const levelsDetails = levels.map(level => {
                const levelSessions = formationSessions.filter(s => s.level?.toString() === level._id.toString());
                const levelSessionIds = levelSessions.map(s => s._id.toString());
                const attendedLevelSessions = userAttendance.filter(a =>
                    levelSessionIds.includes(a.session.toString()) && ['present', 'late'].includes(a.status)
                ).length;

                let status = 'locked';
                if (levelSessions.length > 0) {
                    if (attendedLevelSessions >= levelSessions.length) {
                        status = 'validated';
                    } else if (attendedLevelSessions > 0) {
                        status = 'in_progress';
                    }
                }

                return {
                    id: level._id,
                    order: level.order,
                    title: level.title,
                    status
                };
            });

            // Sessions for recent activity combine
            const resultSessions = formationSessions.map(s => ({
                id: s._id,
                title: s.level?.title || `Session ${s.date.toLocaleDateString()}`,
                date: s.date,
                attendanceStatus: attendanceMap.get(s._id.toString()) || 'pending'
            }));

            resultFormations.push({
                _id: formation._id,
                title: formation.title,
                description: formation.description,
                progress,
                levelsDetails,
                sessions: resultSessions
            });
        }

        // 3. Upcoming sessions
        const now = new Date();
        const upcomingSessions = await Session.find({
            participants: userId,
            date: { $gte: now }
        })
            .populate('formation', 'title')
            .populate('level', 'title')
            .populate('formateur', 'name')
            .sort({ date: 1, startTime: 1 })
            .limit(5);

        const formattedUpcoming = upcomingSessions.map(s => ({
            id: s._id,
            title: s.formation?.title || 'Formation',
            level: s.level?.title || 'Session',
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            formateur: s.formateur?.name || 'Staff'
        }));

        // 4. Missed sessions
        const missedAttendance = await Attendance.find({
            participant: userId,
            status: 'absent'
        }).populate({
            path: 'session',
            populate: { path: 'formation', select: 'title' }
        });

        const formattedMissed = missedAttendance.map(a => ({
            id: a.session?._id,
            title: a.session?.formation?.title || 'Formation',
            date: a.session?.date,
            type: 'missed'
        })).filter(s => s.id);

        // 5. Global Stats
        const totalAttended = await Attendance.countDocuments({
            participant: userId,
            status: { $in: ['present', 'late'] }
        });

        const totalMissed = await Attendance.countDocuments({
            participant: userId,
            status: 'absent'
        });

        res.json({
            stats: {
                totalFormations: formations.length,
                totalSessionsAttended: totalAttended,
                totalMissedSessions: totalMissed
            },
            formations: resultFormations,
            upcomingSessions: formattedUpcoming,
            missedSessions: formattedMissed
        });

    } catch (error) {
        console.error('Student dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/student/certificate/download/:formationId
// @desc    Download certificate PDF for the student
// @access  Private (Student)
router.get('/certificate/download/:formationId', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const formationId = req.params.formationId;

        // 1. Check if certificate exists for this student and formation
        const certificate = await Certificate.findOne({ user: userId, formation: formationId })
            .populate('user')
            .populate('formation');

        if (!certificate) {
            return res.status(404).json({ error: 'Certificat non trouvé pour cette formation.' });
        }

        // 2. Verify certificate belongs to the student (double check)
        if (certificate.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Accès refusé.' });
        }

        // 3. Generate PDF (Reuse logic from administratif.js)
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Certificat-${certificate.certificateId}.pdf`);

        doc.pipe(res);

        // --- PDF DESIGN ---
        doc.fontSize(24).font('Helvetica-Bold').text('ASTBA FORMATION', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text('Académie des Sciences et Technologies', { align: 'center' });
        doc.moveDown(2);

        doc.rect(50, 150, 742, 2).fill('#334155'); // Decorative line
        doc.moveDown(2);
        doc.fontSize(30).fillColor('#1e293b').font('Helvetica-Bold').text('CERTIFICAT DE RÉUSSITE', { align: 'center' });
        doc.moveDown();

        doc.fontSize(16).font('Helvetica').fillColor('black').text('Ce certificat est fièrement décerné à :', { align: 'center' });
        doc.moveDown();

        doc.fontSize(28).font('Helvetica-Bold').fillColor('#2563eb').text(certificate.user.name.toUpperCase(), { align: 'center' });
        doc.moveDown();

        doc.fontSize(16).font('Helvetica').fillColor('black').text('Pour avoir validé avec succès tous les niveaux de la formation :', { align: 'center' });
        doc.moveDown();

        doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text(certificate.formation.title, { align: 'center' });
        doc.moveDown(3);

        const date = new Date(certificate.issuedAt).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        doc.fontSize(12).font('Helvetica').text(`Fait à Tunis, le ${date}`, 100, 450);
        doc.fontSize(12).font('Helvetica-Bold').text('Le Responsable de Formation', 550, 450);
        doc.fontSize(10).font('Helvetica-Oblique').text('(Signature numérique)', 550, 500);

        doc.rect(50, 520, 742, 2).fill('#334155'); // Bottom line
        doc.fontSize(9).text(`ID Certificat: ${certificate.certificateId}`, 50, 530, { align: 'center', color: 'gray' });

        doc.end();

    } catch (error) {
        console.error('Download certificate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Session = require('../models/Session');
const Formation = require('../models/Formation');
const Attendance = require('../models/Attendance');
const Level = require('../models/Level');

// @route   GET /api/student/dashboard
// @desc    Get student dashboard data (formations, progress, stats)
// @access  Private (Student)
router.get('/dashboard', authenticate, async (req, res) => {
    try {
        // Ensure user is a student (or has appropriate access)
        if (req.user.role !== 'student' && req.user.role !== 'admin' && req.user.role !== 'Responsable') {
            return res.status(403).json({ error: 'Access denied. Student resource.' });
        }

        const studentId = req.user._id;

        // 1. Find all sessions where the student is a participant
        const sessions = await Session.find({ participants: studentId })
            .populate('formation', 'title description duration')
            .populate('level', 'title order')
            .populate('formateur', 'name')
            .sort({ date: 1 });

        // 2. Extract unique formations
        const formationMap = {};
        const allFormationIds = [];

        sessions.forEach(session => {
            if (session.formation && !formationMap[session.formation._id]) {
                formationMap[session.formation._id] = {
                    _id: session.formation._id,
                    title: session.formation.title,
                    description: session.formation.description,
                    duration: session.formation.duration,
                    sessions: [],
                    levels: new Set(),
                    totalSessions: 0,
                    attendedSessions: 0,
                    missedSessions: 0
                };
                allFormationIds.push(session.formation._id);
            }

            if (session.formation) {
                formationMap[session.formation._id].sessions.push(session);
                if (session.level) {
                    formationMap[session.formation._id].levels.add(session.level.title);
                }
            }
        });

        // 3. Get attendance records for this student
        const attendanceRecords = await Attendance.find({
            participant: studentId,
            session: { $in: sessions.map(s => s._id) }
        });

        // Map attendance by session ID for quick lookup
        const attendanceMap = {};
        attendanceRecords.forEach(a => {
            attendanceMap[a.session.toString()] = a.status;
        });

        // 4. Calculate stats per formation
        const formations = Object.values(formationMap).map(f => {
            let attended = 0;
            let missed = 0;

            f.sessions.forEach(session => {
                const status = attendanceMap[session._id.toString()] || 'pending'; // Default to pending if not marked
                if (status === 'present') attended++;
                if (status === 'absent') missed++;

                // Attach status to session object for frontend
                session.attendanceStatus = status;
            });

            // Calculate Level Details
            const levelMap = {};
            f.levels.forEach(lvlTitle => {
                levelMap[lvlTitle] = {
                    title: lvlTitle,
                    total: 0,
                    attended: 0,
                    status: 'pending' // pending, in_progress, validated
                };
            });

            f.sessions.forEach(session => {
                const lvlTitle = session.level?.title;
                if (lvlTitle && levelMap[lvlTitle]) {
                    levelMap[lvlTitle].total++;
                    if (attendanceMap[session._id.toString()] === 'present') {
                        levelMap[lvlTitle].attended++;
                    }
                }
            });

            const levelsDetails = Object.values(levelMap).map(lvl => {
                if (lvl.total === 0) return { ...lvl, status: 'locked' }; // Or pending
                if (lvl.attended === lvl.total) return { ...lvl, status: 'validated' };
                if (lvl.attended > 0) return { ...lvl, status: 'in_progress' };
                return { ...lvl, status: 'pending' };
            });


            return {
                ...f,
                levels: Array.from(f.levels),
                levelsDetails, // Add this
                totalSessions: f.sessions.length,
                attendedSessions: attended,
                missedSessions: missed,
                progress: f.sessions.length > 0 ? Math.round((attended / f.sessions.length) * 100) : 0
            };
        });

        // 5. Aggregate Global Stats
        const totalFormations = formations.length;
        const totalSessionsEnrolled = sessions.length;
        const totalSessionsAttended = formations.reduce((acc, curr) => acc + curr.attendedSessions, 0);

        const totalMissedSessions = formations.reduce((acc, curr) => acc + curr.missedSessions, 0);

        // Extract missed sessions details
        const missedSessionsList = sessions
            .filter(s => attendanceMap[s._id.toString()] === 'absent')
            .map(s => ({
                id: s._id,
                title: s.formation.title,
                date: s.date,
                startTime: s.startTime,
                formateur: s.formateur?.name || 'Instructeur'
            }));

        // 6. Get upcoming sessions
        const now = new Date();
        const upcomingSessions = sessions
            .filter(s => new Date(s.date) >= now)
            .slice(0, 5) // Next 5 sessions
            .map(s => ({
                id: s._id,
                title: s.formation.title,
                description: s.formation.description,
                date: s.date,
                startTime: s.startTime,
                endTime: s.endTime,
                level: s.level?.title,
                formateur: s.formateur?.name || 'TBA'
            }));

        res.json({
            stats: {
                totalFormations,
                totalSessionsEnrolled,
                totalSessionsAttended,
                totalMissedSessions
            },
            formations,
            missedSessions: missedSessionsList,
            upcomingSessions
        });

    } catch (error) {
        console.error('Student dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/student/certificate/:formationId
// @desc    Download certificate for a completed formation
// @access  Private (Student)
router.get('/certificate/:formationId', authenticate, async (req, res) => {
    try {
        const studentId = req.user._id;
        const formationId = req.params.formationId;

        // 1. Check if formation exists
        const formation = await Formation.findById(formationId);
        if (!formation) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        // 2. Calculate progress (Reuse logic or simplify)
        // Find all sessions for this formation
        const sessions = await Session.find({
            formation: formationId,
            participants: studentId
        });

        if (sessions.length === 0) {
            return res.status(400).json({ error: 'No sessions found for this formation' });
        }

        // Check attendance for all these sessions
        const attendedCount = await Attendance.countDocuments({
            participant: studentId,
            session: { $in: sessions.map(s => s._id) },
            status: 'present'
        });

        const progress = Math.round((attendedCount / sessions.length) * 100);

        if (progress < 100) {
            return res.status(403).json({ error: 'Certificate not available. You must complete 100% of the formation.' });
        }

        // 3. Generate PDF
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            layout: 'landscape',
            size: 'A4',
            margin: 0
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Certificate-${formation.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);

        doc.pipe(res);

        // --- PDF Content Design (Single Page V2 - Mockup Match) ---
        const width = doc.page.width;
        const height = doc.page.height;

        // Define Colors
        const primaryBlue = '#0ea5e9'; // Sky blue/Cyan-ish
        const darkText = '#1f2937';    // Gray-900
        const lightText = '#6b7280';   // Gray-500

        const margin = 40;

        // --- Background & Border ---

        // Outer border (Thin)
        doc.rect(margin, margin, width - (margin * 2), height - (margin * 2))
            .lineWidth(1)
            .stroke(primaryBlue);

        // Inner border (Thicker/Accented)
        doc.rect(margin + 5, margin + 5, width - (margin * 2) - 10, height - (margin * 2) - 10)
            .lineWidth(2)
            .strokeOpacity(0.3)
            .stroke(primaryBlue);

        doc.strokeOpacity(1); // Reset

        // Corner Accents (L-shapes)
        const cornerSize = 30;
        const cornerMargin = margin - 10;

        doc.lineWidth(2).strokeColor(primaryBlue);

        // Top Left
        doc.moveTo(cornerMargin, cornerMargin + cornerSize).lineTo(cornerMargin, cornerMargin).lineTo(cornerMargin + cornerSize, cornerMargin).stroke();
        // Top Right
        const trX = width - cornerMargin;
        doc.moveTo(trX - cornerSize, cornerMargin).lineTo(trX, cornerMargin).lineTo(trX, cornerMargin + cornerSize).stroke();
        // Bottom Left
        const blY = height - cornerMargin;
        doc.moveTo(cornerMargin, blY - cornerSize).lineTo(cornerMargin, blY).lineTo(cornerMargin + cornerSize, blY).stroke();
        // Bottom Right
        const brX = width - cornerMargin;
        doc.moveTo(brX - cornerSize, blY).lineTo(brX, blY).lineTo(brX, blY - cornerSize).stroke();

        // --- Content ---

        // 1. Icon / Medal (Top Center)
        const centerX = width / 2;
        const topY = 100;

        doc.save();
        doc.translate(centerX, topY);
        // Ribbon path
        doc.path('M -10 0 L -10 30 L 0 40 L 10 30 L 10 0 Z')
            .fill(primaryBlue);
        // Medal Circle
        doc.circle(0, 45, 12).fill(primaryBlue);
        // Star inside
        doc.fillColor('white').fontSize(12).text('★', -4, 39);
        doc.restore();

        // 2. Organization Name
        doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue)
            .text('ADVANCED SECURITY TRAINING & BALLISTICS ACADEMY', 0, 160, { align: 'center' });

        // 3. Main Title
        doc.font('Helvetica-Bold').fontSize(36).fillColor(darkText)
            .text('Certificate of Completion', 0, 190, { align: 'center' });

        // 4. Subtitle
        doc.font('Helvetica-Oblique').fontSize(14).fillColor(lightText)
            .text('This is to certify that', 0, 240, { align: 'center' });

        // 5. Student Name
        doc.font('Helvetica-Bold').fontSize(32).fillColor(darkText)
            .text(req.user.name, 0, 270, { align: 'center' });

        // Underline Name
        const nameWidth = doc.widthOfString(req.user.name);
        doc.moveTo(centerX - (nameWidth / 2) - 20, 310)
            .lineTo(centerX + (nameWidth / 2) + 20, 310)
            .lineWidth(1).strokeColor(primaryBlue).opacity(0.5).stroke();

        // 6. Body Text
        doc.font('Helvetica').fontSize(14).fillColor(lightText)
            .text('Has successfully completed the comprehensive', 0, 330, { align: 'center' });
        doc.text('professional training program in', 0, 350, { align: 'center' });

        // 7. Formation Title
        doc.font('Helvetica-Bold').fontSize(24).fillColor(primaryBlue)
            .text(formation.title.toUpperCase(), 0, 380, { align: 'center' });

        // --- Footer Section ---
        const footerY = height - 100;

        // Director Signature (Left)
        doc.moveTo(100, footerY).lineTo(250, footerY).lineWidth(1).strokeColor(lightText).stroke();
        doc.font('Helvetica-Bold').fontSize(10).fillColor(darkText)
            .text('DIRECTOR SIGNATURE', 100, footerY + 10, { width: 150, align: 'left' });
        doc.font('Helvetica').fontSize(8).fillColor(lightText)
            .text(`Verification ID: CERT-${formation._id.toString().slice(-6).toUpperCase()}`, 100, footerY + 25, { width: 150, align: 'left' });

        // QR Code Placeholder (Center)
        doc.rect(centerX - 25, footerY - 20, 50, 50).strokeColor(lightText).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(primaryBlue)
            .text('SCAN TO VERIFY', centerX - 30, footerY + 35, { width: 60, align: 'center' });

        // Date (Right) with specific styling
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        doc.font('Helvetica-Bold').fontSize(14).fillColor(darkText)
            .text(dateStr, width - 260, footerY - 25, { width: 160, align: 'center' });

        doc.moveTo(width - 250, footerY).lineTo(width - 100, footerY).stroke();

        doc.font('Helvetica-Bold').fontSize(8).fillColor(lightText)
            .text('DATE OF ISSUE', width - 260, footerY + 10, { width: 160, align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Certificate generation error:', error);
        res.status(500).json({ error: 'Server error generating certificate' });
    }
});

module.exports = router;

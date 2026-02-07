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

module.exports = router;

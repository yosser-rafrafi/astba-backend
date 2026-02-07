const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Formation = require('./models/Formation');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');

async function checkV3() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // 1. Check Sessions
        const sessions = await Session.find().populate('formation', 'title');
        console.log(`\n📊 Total Sessions: ${sessions.length}`);
        sessions.forEach(s => console.log(`- [${s.formation?.title || 'Unknown'}] on ${s.date ? s.date.toLocaleDateString() : 'N/A'}`));

        // 2. Check Attendance
        const attendance = await Attendance.find().populate('participant', 'name email').populate('session');
        console.log(`\n📝 Attendance Records: ${attendance.length}`);
        attendance.forEach(a => console.log(`- ${a.participant?.name || 'Unknown'}: ${a.status} in session ${a.session?._id}`));

        // 3. Verify Progress Logic for a Participant
        const participants = await User.find({ role: 'Responsable' });
        if (participants.length > 0) {
            const p = participants[0];
            console.log(`\n🔍 Verifying Progress for: ${p.name}`);

            // Missed Sessions
            const missed = await Attendance.find({ participant: p._id, status: 'absent' });
            console.log(`- Missed Sessions Count: ${missed.length}`);

            // Progress for first formation found in sessions
            if (sessions.length > 0) {
                const formationId = sessions[0].formation?._id;
                const totalInFormation = await Session.countDocuments({ formation: formationId });
                const attendedInFormation = await Attendance.countDocuments({
                    participant: p._id,
                    session: { $in: await Session.find({ formation: formationId }).distinct('_id') },
                    status: { $in: ['present', 'late'] }
                });
                const progress = totalInFormation > 0 ? Math.round((attendedInFormation / totalInFormation) * 100) : 0;
                console.log(`- Formation [${sessions[0].formation?.title || 'N/A'}]: ${attendedInFormation}/${totalInFormation} sessions attended (${progress}%)`);
            }
        } else {
            console.log('\n⚠️ No participants found to verify progress.');
        }

        await mongoose.connection.close();
        console.log('\n✨ Verification script finished.');
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

checkV3();

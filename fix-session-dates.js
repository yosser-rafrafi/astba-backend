const mongoose = require('mongoose');
require('dotenv').config();

const Formation = require('./models/Formation');
const Session = require('./models/Session');

async function fixSessionDates() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        const sessions = await Session.find().populate('formation');
        console.log(`Checking ${sessions.length} sessions...`);

        let fixedCount = 0;
        for (const session of sessions) {
            if (session.formation && session.formation.startDate) {
                const sessionDate = new Date(session.date);
                const formationStartDate = new Date(session.formation.startDate);

                // If session date is before formation start date
                if (sessionDate < formationStartDate) {
                    console.log(`⚠️  Fixing session ${session._id}: ${sessionDate.toISOString().split('T')[0]} is before formation start ${formationStartDate.toISOString().split('T')[0]}`);

                    session.date = formationStartDate;
                    await session.save();
                    fixedCount++;
                }
            }
        }

        console.log(`\n✅ Done! Fixed ${fixedCount} sessions.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fixing session dates:', err);
        process.exit(1);
    }
}

fixSessionDates();

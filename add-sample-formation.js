const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Formation = require('./models/Formation');
const Session = require('./models/Session');

async function addSample() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        const formateur = await User.findOne({ role: 'formateur' });
        if (!formateur) {
            console.log('❌ No formateur found to create formation.');
            await mongoose.connection.close();
            return;
        }

        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const formation = await Formation.create({
            title: 'Navigation de Nuit - Advanced',
            description: 'Formation intensive sur les techniques de navigation nocturne et lecture radar.',
            duration: 12,
            startDate: today,
            createdBy: formateur._id
        });
        console.log(`📚 Formation created: ${formation.title} for ${today.toLocaleDateString()}`);

        const session = await Session.create({
            formation: formation._id,
            date: tomorrow,
            startTime: '20:00',
            endTime: '23:59',
            formateur: formateur._id,
            maxParticipants: 15
        });
        console.log(`📅 Session created: ${session.startTime} on ${tomorrow.toLocaleDateString()}`);

        await mongoose.connection.close();
        console.log('\n✨ Sample data added successfully!');
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

addSample();

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Formation = require('./models/Formation');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // 1. Create a Test Responsable (Learner)
        let responsable = await User.findOne({ email: 'test_responsable@maratech.tn' });
        if (!responsable) {
            responsable = await User.create({
                name: 'Test Responsable',
                email: 'test_responsable@maratech.tn',
                password: 'password123',
                role: 'Responsable'
            });
            console.log('👤 Test Responsable created');
        }

        // 2. Create a Test Formateur
        let formateur = await User.findOne({ email: 'test_formateur@maratech.tn' });
        if (!formateur) {
            formateur = await User.create({
                name: 'Test Formateur',
                email: 'test_formateur@maratech.tn',
                password: 'password123',
                role: 'formateur'
            });
            console.log('👨‍🏫 Test Formateur created');
        }

        // 3. Create a Formation
        const formation = await Formation.create({
            title: 'Sécurité Maritime (V3 Test)',
            description: 'Techniques de survie et sécurité en mer.',
            duration: 15,
            createdBy: formateur._id
        });
        console.log('📚 Test Formation created');

        // 4. Create 2 Sessions
        const s1 = await Session.create({
            formation: formation._id,
            date: new Date(),
            startTime: '08:00',
            endTime: '11:00',
            formateur: formateur._id,
            participants: [responsable._id],
            maxParticipants: 10
        });
        const s2 = await Session.create({
            formation: formation._id,
            date: new Date(Date.now() + 86400000), // tomorrow
            startTime: '13:00',
            endTime: '16:00',
            formateur: formateur._id,
            participants: [responsable._id],
            maxParticipants: 10
        });
        console.log('📅 2 Test Sessions created');

        // 5. Create Attendance: 1 Present, 1 Absent
        await Attendance.create({
            session: s1._id,
            participant: responsable._id,
            status: 'present',
            markedBy: formateur._id
        });
        await Attendance.create({
            session: s2._id,
            participant: responsable._id,
            status: 'absent',
            markedBy: formateur._id
        });
        console.log('📝 Test Attendance marked: 1 Present, 1 Absent');

        await mongoose.connection.close();
        console.log('\n✅ Seeding complete. You can now verify the dashboard with: test_responsable@maratech.tn / password123');
    } catch (err) {
        console.error('❌ Seeding Error:', err);
    }
}

seedData();

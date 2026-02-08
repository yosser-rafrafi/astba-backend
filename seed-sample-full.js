const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Formation = require('./models/Formation');
const Level = require('./models/Level');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');
const Certificate = require('./models/Certificate');

const sampleData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // 1. Create a few more students
        const studentsData = [
            { name: 'Alice Student', email: 'alice@test.com', role: 'student' },
            { name: 'Bob Student', email: 'bob@test.com', role: 'student' }
        ];

        const seededStudents = [];
        for (const s of studentsData) {
            let user = await User.findOne({ email: s.email });
            if (!user) {
                user = new User({ ...s, password: 'password123', status: 'active' });
                await user.save();
                console.log(`👤 Student created: ${s.name}`);
            }
            seededStudents.push(user);
        }

        // 2. Create a formateur
        let formateur = await User.findOne({ email: 'expert@astba.com' });
        if (!formateur) {
            formateur = new User({
                name: 'Expert Formateur',
                email: 'expert@astba.com',
                password: 'password123',
                role: 'formateur',
                status: 'active'
            });
            await formateur.save();
            console.log('👨‍🏫 Formateur created: Expert Formateur');
        }

        // 3. Admin for creation
        const admin = await User.findOne({ role: 'admin' }) || seededStudents[0];

        // 4. Create new Formations
        const formationsData = [
            { title: 'Développement Web Fullstack', description: 'Apprenez React, Node, et MongoDB.', duration: 40 },
            { title: 'Intelligence Artificielle', description: 'Introduction au Machine Learning.', duration: 30 },
            { title: 'Cyber-sécurité Maritime', description: 'Protéger les infrastructures portuaires.', duration: 25 }
        ];

        for (const f of formationsData) {
            let formation = await Formation.findOne({ title: f.title });
            if (!formation) {
                formation = new Formation({
                    ...f,
                    startDate: new Date(),
                    createdBy: admin._id
                });
                await formation.save();
                console.log(`📚 Formation created: ${f.title}`);

                // Auto-create levels (4 levels)
                for (let i = 1; i <= 4; i++) {
                    await new Level({
                        formation: formation._id,
                        order: i,
                        title: `Niveau ${i}: ${f.title.split(' ')[0]}`
                    }).save();
                }

                // Create some sessions for these formations
                const levels = await Level.find({ formation: formation._id });
                for (const level of levels) {
                    const session = new Session({
                        formation: formation._id,
                        level: level._id,
                        date: new Date(Date.now() + (level.order * 86400000)), // tomorrow, next day, etc.
                        startTime: '09:00',
                        endTime: '12:00',
                        formateur: formateur._id,
                        participants: seededStudents.map(s => s._id)
                    });
                    await session.save();
                    console.log(`📅 Session created for ${f.title} - ${level.title}`);
                }
            }
        }

        // 5. Add 'student@test.com' to these new formations sessions too (if student exists)
        const mainStudent = await User.findOne({ email: 'student@test.com' });
        if (mainStudent) {
            const allSessions = await Session.find({});
            for (const s of allSessions) {
                if (!s.participants.includes(mainStudent._id)) {
                    s.participants.push(mainStudent._id);
                    await s.save();
                }
            }
            console.log('✅ Main student enrolled in all existing and new sessions');
        }

        console.log('\n✨ Seeding complete. All data added without deleting existing ones.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

sampleData();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Formation = require('./models/Formation');
const Level = require('./models/Level');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');
const Certificate = require('./models/Certificate');

const seedUsers = async () => {
    // 1. Admin
    const admin = new User({
        name: 'Admin User',
        email: 'admin@astba.com',
        password: 'password123',
        role: 'admin',
        status: 'active'
    });

    // 2. Formateurs
    const formateur1 = new User({
        name: 'Jean Formateur',
        email: 'jean@astba.com',
        password: 'password123',
        role: 'formateur',
        status: 'active'
    });

    const formateur2 = new User({
        name: 'Sarah Formateur',
        email: 'sarah@astba.com',
        password: 'password123',
        role: 'formateur',
        status: 'active'
    });

    // 3. Managers (Responsables) - Active
    const managers = [];
    for (let i = 1; i <= 5; i++) {
        managers.push(new User({
            name: `Manager ${i}`,
            email: `manager${i}@company.com`,
            password: 'password123',
            role: 'Responsable',
            status: 'active'
        }));
    }

    // 4. Managers - Pending
    const pendingManager = new User({
        name: 'Pending User',
        email: 'pending@company.com',
        password: 'password123',
        role: 'Responsable',
        status: 'pending'
    });

    // 5. Managers - Suspended
    const suspendedManager = new User({
        name: 'Suspended User',
        email: 'suspended@company.com',
        password: 'password123',
        role: 'Responsable',
        status: 'suspended'
    });

    // Save all users
    await User.deleteMany({});
    await admin.save();
    await formateur1.save();
    await formateur2.save();
    for (const m of managers) await m.save();
    await pendingManager.save();
    await suspendedManager.save();

    console.log('Users seeded');
    return { admin, formateur1, formateur2, managers };
};

const seedFormations = async (users) => {
    const { admin, formateur1, formateur2, managers } = users;

    await Formation.deleteMany({});
    await Level.deleteMany({});
    await Session.deleteMany({});
    await Attendance.deleteMany({});
    await Certificate.deleteMany({});

    // Formation 1: Leadership (Completed)
    const f1 = new Formation({
        title: 'Leadership Avancé',
        description: 'Formation pour les futurs leaders.',
        duration: 20,
        startDate: new Date('2023-09-01'),
        createdBy: admin._id
    });
    await f1.save();

    // Levels for F1
    const l1_1 = new Level({ formation: f1._id, order: 1, title: 'Bases du Leadership' });
    const l1_2 = new Level({ formation: f1._id, order: 2, title: 'Gestion d\'équipe' });
    await l1_1.save();
    await l1_2.save();

    // Sessions for F1 (All in past)
    const sessionsF1 = [];
    sessionsF1.push(new Session({ formation: f1._id, level: l1_1._id, date: new Date('2023-09-10'), startTime: '09:00', endTime: '12:00', formateur: formateur1._id, participants: managers.map(m => m._id) }));
    sessionsF1.push(new Session({ formation: f1._id, level: l1_1._id, date: new Date('2023-09-17'), startTime: '09:00', endTime: '12:00', formateur: formateur1._id, participants: managers.map(m => m._id) }));
    sessionsF1.push(new Session({ formation: f1._id, level: l1_2._id, date: new Date('2023-10-01'), startTime: '09:00', endTime: '12:00', formateur: formateur2._id, participants: managers.map(m => m._id) }));
    sessionsF1.push(new Session({ formation: f1._id, level: l1_2._id, date: new Date('2023-10-08'), startTime: '09:00', endTime: '12:00', formateur: formateur2._id, participants: managers.map(m => m._id) }));

    for (const s of sessionsF1) await s.save();

    // Attendance for F1 (Manager 1 was present for all)
    for (const s of sessionsF1) {
        // Manager 1: Present
        await new Attendance({ session: s._id, participant: managers[0]._id, status: 'present', markedBy: formateur1._id }).save();
        // Manager 2: Mixed
        await new Attendance({ session: s._id, participant: managers[1]._id, status: Math.random() > 0.8 ? 'absent' : 'present', markedBy: formateur1._id }).save();
    }

    // Certificate for Manager 1
    const cert1 = new Certificate({ user: managers[0]._id, formation: f1._id, issuedBy: admin._id });
    await cert1.save();


    // Formation 2: Innovation Tech (Ongoing)
    const f2 = new Formation({
        title: 'Innovation Technologique',
        description: 'Les dernières tendances tech.',
        duration: 15,
        startDate: new Date('2024-01-15'),
        createdBy: admin._id
    });
    await f2.save();

    const l2_1 = new Level({ formation: f2._id, order: 1, title: 'Introduction IA' });
    await l2_1.save();

    // Sessions F2
    const s2_1 = new Session({ formation: f2._id, level: l2_1._id, date: new Date('2024-02-01'), startTime: '14:00', endTime: '17:00', formateur: formateur1._id, participants: managers.map(m => m._id) });
    await s2_1.save();

    // Attendance F2 (Mixed)
    for (const m of managers) {
        await new Attendance({ session: s2_1._id, participant: m._id, status: Math.random() > 0.2 ? 'present' : 'late', markedBy: formateur1._id }).save();
    }

    console.log('Formations, Sessions, Attendance, Certificates seeded');
};

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await seedUsers();
        await seedFormations(users);

        console.log('Database seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seed();

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function fixRoles() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Update all lowercase 'responsable' to 'Responsable'
        const result = await User.updateMany(
            { role: 'responsable' },
            { $set: { role: 'Responsable' } }
        );
        console.log(`Updated ${result.modifiedCount} users to 'Responsable'`);

        // Create or update 'responsible@gmail.com'
        let user = await User.findOne({ email: 'responsible@gmail.com' });
        if (!user) {
            user = new User({
                name: 'Responsable User 2',
                email: 'responsible@gmail.com',
                password: 'password123',
                role: 'Responsable'
            });
            await user.save();
            console.log('Created user responsible@gmail.com');
        } else {
            user.role = 'Responsable';
            await user.save();
            console.log('Updated existing user responsible@gmail.com');
        }

        // Just to be sure, check another one
        const allUsers = await User.find({}, 'email role');
        console.log('Current users and roles:');
        allUsers.forEach(u => console.log(`- ${u.email}: ${u.role}`));

        await mongoose.connection.close();
        console.log('Done');
    } catch (err) {
        console.error('Error:', err);
    }
}

fixRoles();

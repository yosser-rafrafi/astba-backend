const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        let admin = await User.findOne({ email: 'admin_test@maratech.tn' });
        if (admin) {
            admin.password = 'password123';
            await admin.save();
            console.log('✅ Admin updated');
        } else {
            admin = new User({
                name: 'Test Admin',
                email: 'admin_test@maratech.tn',
                password: 'password123',
                role: 'admin'
            });
            await admin.save();
            console.log('✅ Admin created');
        }
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

createAdmin();

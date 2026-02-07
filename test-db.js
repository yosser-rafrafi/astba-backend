const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected successfully!');

        const User = require('./models/User');
        const count = await User.countDocuments();
        console.log('Total users:', count);

        const users = await User.find({}, 'name email role');
        console.log('Users in DB:', JSON.stringify(users, null, 2));

        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
}

testConnection();

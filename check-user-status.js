require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUser() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/astba_hackathon');
        console.log('Connected to MongoDB\n');

        const user = await User.findOne({ email: 'yass@gmail.com' });

        if (!user) {
            console.log('User not found!');
        } else {
            console.log('User Details:');
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            console.log('Status:', user.status);
            console.log('Name:', user.name);
            console.log('\nRaw status value:', JSON.stringify(user.status));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUser();

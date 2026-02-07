const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function testAddUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const testEmail = `test_admin_add_${Date.now()}@example.com`;
        const userData = {
            name: 'Test Add User',
            email: testEmail,
            password: 'password123',
            role: 'formateur'
        };

        // Simulate logic from administratif.js POST
        let user = await User.findOne({ email: userData.email });
        if (user) {
            console.log('User already exists');
        } else {
            user = new User(userData);
            await user.save();
            console.log('✅ User created successfully:', user.email);
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Error saving user:', err.message);
        if (err.errors) {
            console.error('Validation errors:', Object.keys(err.errors).join(', '));
        }
    }
}

testAddUser();

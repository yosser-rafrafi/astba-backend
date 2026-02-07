const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth/signup';

const testSignup = async () => {
    try {
        const uniqueEmail = `student_${Date.now()}@test.com`;
        const payload = {
            name: 'Test Student',
            email: uniqueEmail,
            password: 'password123',
            role: 'student'
        };

        console.log('Attempting signup with:', payload);

        const response = await axios.post(API_URL, payload);
        console.log('Signup Success:', response.data);
    } catch (error) {
        console.error('Signup Failed:', error.response ? error.response.data : error.message);
    }
};

testSignup();

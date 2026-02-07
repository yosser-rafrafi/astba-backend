const axios = require('axios');

const API_URL = 'http://localhost:5002/api/auth';

const runTest = async () => {
    try {
        // 1. Signup
        const email = `testuser_${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`\n1. Attempting Signup with ${email}...`);

        const signupRes = await axios.post(`${API_URL}/signup`, {
            name: 'Test User',
            email,
            password,
            role: 'formateur'
        });
        console.log('✅ Signup successful');
        console.log('Token:', signupRes.data.token ? 'Received' : 'Missing');

        // 2. Login
        console.log(`\n2. Attempting Login with ${email}...`);
        const loginRes = await axios.post(`${API_URL}/login`, {
            email,
            password
        });
        console.log('✅ Login successful');
        const token = loginRes.data.token;
        console.log('Token:', token ? 'Received' : 'Missing');

        if (!token) {
            console.error('❌ Login did not return a token!');
            return;
        }

        // 3. Access Protected Route
        console.log('\n3. Attempting to access Protected Route (/me)...');
        const meRes = await axios.get(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Protected Route Access successful');
        console.log('User:', meRes.data.user);

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
};

runTest();

const axios = require('axios');

const API_URL = 'http://localhost:5002/api';
const AUTH_URL = 'http://localhost:5002/api/auth';

const testVoice = async () => {
    try {
        console.log('1. Logging in to get token...');
        const loginRes = await axios.post(`${AUTH_URL}/login`, {
            email: 'debug@astba.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log('✅ Login successful. Token obtained.');

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // Test Cases
        const testCases = [
            {
                name: 'Navigate to Home',
                payload: { userInput: 'aller à la page accueil' }
            },
            {
                name: 'Fill Email',
                payload: {
                    userInput: 'mon email est test@example.com',
                    pageContext: {
                        formFields: [{ id: 'email', label: 'Email Address', type: 'email' }]
                    }
                }
            },
            {
                name: 'Click Login',
                payload: { userInput: 'clique sur se connecter' }
            }
        ];

        for (const test of testCases) {
            console.log(`\nTesting: ${test.name}`);
            try {
                const res = await axios.post(`${API_URL}/voice/command`, test.payload, config);
                console.log('Response:', res.data);
            } catch (err) {
                console.error('Failed:', err.response ? err.response.data : err.message);
            }
        }

    } catch (error) {
        console.error('Test Setup Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error config:', error.config);
        }
    }
};

testVoice();

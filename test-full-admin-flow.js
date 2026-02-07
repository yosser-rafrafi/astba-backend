const axios = require('axios');

async function testFullFlow() {
    const api = axios.create({
        baseURL: 'http://localhost:5000/api'
    });

    try {
        console.log('Logging in as admin...');
        const loginRes = await api.post('/auth/login', {
            email: 'admin_test@maratech.tn',
            password: 'password123'
        });

        const token = loginRes.data.token;
        console.log('✅ Login success. Token received.');

        const testEmail = `full_flow_test_${Date.now()}@example.com`;
        console.log('Adding new user:', testEmail);

        const addRes = await api.post('/admin/users', {
            name: 'Full Flow Test',
            email: testEmail,
            password: 'password123',
            role: 'formateur'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ User added successfully:', addRes.data.message);
    } catch (error) {
        console.error('❌ Flow failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        } else {
            console.error('Message:', error.message);
        }
    }
}

testFullFlow();

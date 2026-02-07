const axios = require('axios');

const login = async () => {
    try {
        console.log('Attempting login...');
        const response = await axios.post('http://localhost:5002/api/auth/login', {
            email: 'admin@astba.com', // Trying a default/likely admin email, or I can try to read the DB.
            password: 'password123'
        });
        console.log('Login successful:', response.data);
    } catch (error) {
        console.error('Login failed:', error.response ? error.response.data : error.message);
        console.error('Status:', error.response ? error.response.status : 'No status');
    }
};

login();

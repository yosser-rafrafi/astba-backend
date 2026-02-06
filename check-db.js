const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Formation = require('./models/Formation');

dotenv.config();

async function checkDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to:', process.env.MONGO_URI);

        const userCount = await User.countDocuments();
        const formationCount = await Formation.countDocuments();

        console.log('Collections present:', Object.keys(mongoose.connection.collections));
        console.log('User count:', userCount);
        console.log('Formation count:', formationCount);

        if (userCount > 0) {
            const latestUser = await User.findOne().sort({ createdAt: -1 });
            console.log('Latest User:', { name: latestUser.name, email: latestUser.email, role: latestUser.role });
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('DB Check Error:', err);
    }
}

checkDB();

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const migrateUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Database');

        const result = await User.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'active' } }
        );

        console.log(`Migration complete. Updated ${result.modifiedCount} users to 'active' status.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateUsers();

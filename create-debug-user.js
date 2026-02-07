const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const email = 'debug@astba.com';
        const password = 'password123';

        try {
            // Delete if exists
            await User.findOneAndDelete({ email });

            const user = new User({
                name: 'Debug User',
                email,
                password,
                role: 'admin', // Giving admin to be sure
                status: 'active' // Bypass approval check
            });

            await user.save();
            console.log(`User created: ${email} / ${password}`);

            // Verify login simulation
            const isMatch = await user.comparePassword(password);
            console.log('Password comparison check:', isMatch ? 'PASS' : 'FAIL');

        } catch (err) {
            console.error(err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error(err));

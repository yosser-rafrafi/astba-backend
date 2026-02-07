const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function createFormateurs() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // Create multiple formateurs
        const formateurs = [
            { name: 'Sophie Martin', email: 'sophie.martin@maratech.tn', password: 'password123', role: 'formateur' },
            { name: 'Ahmed Ben Ali', email: 'ahmed.benali@maratech.tn', password: 'password123', role: 'formateur' },
            { name: 'Marie Dubois', email: 'marie.dubois@maratech.tn', password: 'password123', role: 'formateur' },
            { name: 'Karim Rezgui', email: 'karim.rezgui@maratech.tn', password: 'password123', role: 'formateur' },
        ];

        for (const formateurData of formateurs) {
            const existing = await User.findOne({ email: formateurData.email });
            if (!existing) {
                await User.create(formateurData);
                console.log(`✅ Created formateur: ${formateurData.name}`);
            } else {
                console.log(`⏭️  Formateur already exists: ${formateurData.name}`);
            }
        }

        await mongoose.connection.close();
        console.log('\n✅ Formateur creation complete!');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

createFormateurs();

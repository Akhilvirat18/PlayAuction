const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const checkDB = async () => {
    try {
        console.log('--- DB SCAN START ---');
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected');

        const admin = conn.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('📂 Databases:', dbs.databases.map(db => db.name).join(', '));

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;
            
            const db = conn.connection.client.db(dbName);
            const collections = await db.listCollections().toArray();
            console.log(`\nDATABASE: ${dbName}`);
            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`  - ${col.name}: ${count} docs`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

checkDB();

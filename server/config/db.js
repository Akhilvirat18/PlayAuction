const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'ipl_data',  // Ensure we connect to the correct database containing all players/pools
            maxPoolSize: 10,      // Maintain up to 10 socket connections for free tier Atlas
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`✅ Cloud MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`💥 Cloud MongoDB Error: ${err.message}`);
        console.error('👉 Tip: Check if MONGO_URI is correctly set in Render Environment Variables.');
        process.exit(1);
    }
};

module.exports = connectDB;

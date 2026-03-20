const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
    try {
        await mongoose.connect('mongodb+srv://mahesh:NdvvOoQnpfJLCFTm@cluster0.eleterk.mongodb.net', { dbName: 'ipl' });
        console.log("Connected");
        const pools = await mongoose.connection.db.collection('new_enhanced').distinct('poolName');
        console.log('Distinct poolNames in DB:', pools);
        fs.writeFileSync('pools_out.txt', JSON.stringify(pools, null, 2));
        
        // Let's also grab one sample player to see its structure
        const sample = await mongoose.connection.db.collection('new_enhanced').findOne();
        fs.writeFileSync('sample_player.txt', JSON.stringify(sample, null, 2));

        console.log("Done");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}
run();

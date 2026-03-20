const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
    try {
        await mongoose.connect('mongodb+srv://mahesh:NdvvOoQnpfJLCFTm@cluster0.eleterk.mongodb.net/ipl');
        console.log("Connected");
        const pools = await mongoose.connection.db.collection('new_enhanced').distinct('poolName');
        console.log('Distinct poolNames in DB:', pools);
        fs.writeFileSync('pools_out.txt', JSON.stringify(pools, null, 2));
        console.log("Done");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();

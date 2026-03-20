const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const Player = require('../models/Player');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI is not defined in .env');
    process.exit(1);
}

// Collections identified from your Compass screenshot
const PLAYER_COLLECTIONS = [
    'marquee_wk', 'marquee_batsmen', 'marquee_bowlers', 'marquee_Allrounder',
    'pool1_wk', 'pool1_batsmen', 'pool1_bowlers', 'pool1_Allrounder',
    'pool2_batsmen', 'pool2_bowlers', 'pool2_allrounder',
    'pool3_batsmen',
    'pool4_wk', 'pool4_batsmen', 'pool4_allrounder',
    'Emerging_players'
];

const basePrices = [20, 50, 75, 100, 150, 200];

const twoCrorePools = [
    'marquee_wk', 'marquee_batsmen', 'marquee_bowlers', 'marquee_Allrounder',
    'pool1_wk', 'pool1_batsmen', 'pool1_bowlers', 'pool1_Allrounder'
];

const oneCrorePools = [
    'pool2_batsmen', 'pool2_bowlers', 'pool2_allrounder', 'pool3_batsmen'
];

const thirtyLakhPools = [
    'pool4_wk', 'pool4_batsmen', 'pool4_allrounder', 'Emerging_players'
];

function getBasePriceFromPool(poolName) {
    if (twoCrorePools.includes(poolName)) return 200;
    if (oneCrorePools.includes(poolName)) return 100;
    if (thirtyLakhPools.includes(poolName)) return 30;
    return getRandomItem(basePrices); // fallback just in case
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeRole(role) {
    if (!role) return 'Batsman';
    const r = role.toLowerCase().trim();
    if (r.includes('wicket')) return 'Wicketkeeper';
    if (r.includes('all-rounder') || r.includes('allrounder')) return 'All-Rounder';
    if (r.includes('batsman') || r.includes('batsmen')) return 'Batsman';
    if (r.includes('bowler')) return 'Bowler';
    return 'Batsman';
}

const importData = async () => {
    let client;
    try {
        console.log('Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGO_URI);
        await client.connect();

        const db = client.db('ipl');
        let allPlayers = [];

        console.log('Fetching players from all pool collections...');
        for (const colName of PLAYER_COLLECTIONS) {
            const raw = await db.collection(colName).find({}).toArray();
            console.log(` - ${colName}: found ${raw.length} players`);
            
            const mapped = raw.map((doc, idx) => {
                const nationality = doc.nationality || 'Unknown';
                const isOverseas = !(['india', 'indian'].includes(nationality.toLowerCase().trim()));
                const playerName = doc.player || doc.Player || doc.name || 'Unknown Player';
                
                return {
                    playerId: `PLY_${colName}_${idx}`,
                    name: playerName,
                    player: playerName,
                    role: normalizeRole(doc.role),
                    nationality: nationality,
                    isOverseas: isOverseas,
                    basePrice: getBasePriceFromPool(colName),
                    poolName: colName,
                    photoUrl: doc.image_path || `https://i.pravatar.cc/150?u=${encodeURIComponent(playerName.replace(/\s/g, ''))}`,
                    stats: {
                        matches: Number(doc.matches) || 0,
                        runs: Number(doc.runs) || 0,
                        wickets: Number(doc.wickets) || 0,
                        battingAvg: Number(doc.batting_avg) || Number(doc.bat_avg) || 0,
                        bowlingAvg: Number(doc.bowling_avg) || Number(doc.bowl_avg) || 0,
                        strikeRate: Number(doc.batting_strike_rate) || Number(doc.strike_rate) || 0,
                        economy: Number(doc.bowling_economy) || Number(doc.economy) || 0,
                        highestScore: String(doc.highest_score || doc.hs || '0'),
                        bestBowling: String(doc.best_bowling || doc.bb || doc.best_bowling_figure || '0/0'),
                        stumpings: Number(doc.stumpings) || 0,
                        catches: Number(doc.catches) || 0,
                        iplSeasonsActive: Math.max(1, Math.floor((Number(doc.matches) || 0) / 14))
                    }
                };
            });
            allPlayers = allPlayers.concat(mapped);
        }

        console.log(`Total players mapped: ${allPlayers.length}`);

        console.log('Connecting Mongoose to ipl database...');
        await mongoose.connect(MONGO_URI, { dbName: 'ipl' });
        
        console.log('Clearing existing data in new_enhanced collection...');
        await Player.deleteMany({});

        console.log('Inserting authentic players...');
        await Player.insertMany(allPlayers);
        
        console.log('SUCCESS: All players imported successfully to ipl.new_enhanced!');
        process.exit(0);
    } catch (error) {
        if (error.name === 'ValidationError') {
            console.error('Validation Error Details:');
            Object.keys(error.errors).forEach(key => {
                console.error(` - Field "${key}": ${error.errors[key].message}`);
            });
        } else {
            console.error('Import Error:', error.message);
        }
        if (client) await client.close();
        process.exit(1);
    }
};

importData();

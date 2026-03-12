const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const Player = require('../models/Player');
require('dotenv').config();

const ATLAS_URI =  process.env.MONGO_URI;
const LOCAL_URI = process.env.MONGO_URI;

const basePrices = [20, 50, 75, 100, 150, 200];
const forms = ['Excellent', 'Decent', 'Poor'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function determineRole(doc) {
    const rawRole = (doc.role || '').toLowerCase();
    if (rawRole.includes('wk') || rawRole.includes('keeper') || doc.stumpings > 0) return 'Wicketkeeper';
    if (rawRole.includes('allrounder') || rawRole.includes('all-rounder') || (doc.wickets >= 10 && doc.runs >= 300)) return 'All-Rounder';
    if (rawRole.includes('bowler') || doc.wickets >= 15) return 'Bowler';
    if (rawRole.includes('batsman') || rawRole.includes('batter') || rawRole.includes('batsmen')) return 'Batsman';
    return 'Batsman'; // Default
}

const importSequentially = async () => {
    let atlasClient;
    try {
        console.log('Connecting to MongoDB Atlas...');
        atlasClient = new MongoClient(ATLAS_URI);
        await atlasClient.connect();
        const atlasDb = atlasClient.db('ipl');

        console.log('Connecting to Local MongoDB...');
        await mongoose.connect(LOCAL_URI, { dbName: 'ipl' });

        // The model says the collection name is 'new_enhanced'
        await Player.deleteMany({});
        console.log('Cleared existing local Player data.');

        const collections = [
            'marqueeset',
            'pool1_batsmen',
            'pool1_bowlers',
            'pool2_batsmen',
            'pool2_bowlers',
            'pool3',
            'pool4'
        ];

        let globalPlayerCount = 0;

        for (const collName of collections) {
            console.log(`Processing collection: ${collName}...`);
            const collection = atlasDb.collection(collName);
            const rawDocs = await collection.find({}).toArray();
            console.log(`Fetched ${rawDocs.length} documents from ${collName}.`);

            const mappedPlayers = rawDocs.map((doc) => {
                const role = determineRole(doc);

                // Pool-specific base prices
                let basePrice = 50; // Default
                if (['marqueeset', 'pool1_batsmen', 'pool1_bowlers'].includes(collName)) {
                    basePrice = 200; // 2 Cr
                } else if (['pool2_batsmen', 'pool2_bowlers'].includes(collName)) {
                    basePrice = 150; // 1.5 Cr
                } else if (collName === 'pool3') {
                    basePrice = 100; // 1 Cr
                } else if (collName === 'pool4') {
                    basePrice = 50; // 50 Lc
                }

                return {
                    name: doc.player || doc.Player || 'Unknown Player',
                    player: doc.player || doc.Player || 'Unknown Player',
                    nationality: doc.nationality || 'Unknown',
                    role: role,
                    poolName: collName,
                    isOverseas: doc.isOverseas || (doc.nationality && doc.nationality !== 'India'),
                    photoUrl: doc.image_path || doc.imagepath || `https://i.pravatar.cc/150?u=${(doc.player || 'unknown').replace(/\s/g, '')}`,
                    imagepath: doc.image_path || doc.imagepath,
                    image_path: doc.image_path || doc.imagepath,
                    basePrice: basePrice,
                    stats: {
                        matches: doc.matches || 0,
                        runs: doc.runs || 0,
                        wickets: doc.wickets || 0,
                        battingAvg: doc.batting_avg || 0,
                        bowlingAvg: doc.bowling_avg || 0,
                        strikeRate: doc.batting_strike_rate || 0,
                        economy: doc.bowling_economy || 0,
                        stumpings: doc.stumpings || 0,
                        catches: doc.catches || 0,
                        iplSeasonsActive: Math.max(1, Math.floor((doc.matches || 0) / 14))
                    },
                    form: {
                        lastMatches: [getRandomItem(forms), getRandomItem(forms), getRandomItem(forms), getRandomItem(forms), getRandomItem(forms)],
                        score: getRandomInt(2, 10),
                        trend: getRandomItem(['Up', 'Stable', 'Down'])
                    }
                };
            });

            // Role sequence: Batsman, Bowler, All-Rounder, Wicketkeeper
            const roleOrder = ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
            const sortedAndShuffledPlayers = [];

            for (const role of roleOrder) {
                const rolePlayers = mappedPlayers.filter(p => p.role === role);
                // Shuffle within each role group
                shuffleArray(rolePlayers);
                sortedAndShuffledPlayers.push(...rolePlayers);
            }

            // Assign playerId based on the final sorted/shuffled order
            const finalPlayers = sortedAndShuffledPlayers.map(p => {
                globalPlayerCount++;
                return {
                    ...p,
                    playerId: `PLY${1000 + globalPlayerCount}`
                };
            });

            if (finalPlayers.length > 0) {
                await Player.insertMany(finalPlayers);
                console.log(`Successfully imported ${finalPlayers.length} players from ${collName} in role-based order.`);
            }
        }

        console.log(`Total players imported: ${globalPlayerCount}`);
        process.exit(0);
    } catch (error) {
        console.error('Import failed:', error);
        if (atlasClient) await atlasClient.close();
        process.exit(1);
    }
};

importSequentially();

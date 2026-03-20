const mongoose = require('mongoose');
const Player = require('../models/Player');

// List of all pool collections from the Compass screenshot
const PLAYER_COLLECTIONS = [
    'marquee_wk', 'marquee_batsmen', 'marquee_bowlers', 'marquee_Allrounder',
    'pool1_wk', 'pool1_batsmen', 'pool1_allrounders','pool1_bowlers', 'pool1_Allrounder',
    'pool2_batsmen', 'pool2_bowlers', 'pool2_allrounder',
    'pool3_batsmen',
    'pool4_wk', 'pool4_batsmen', 'pool4_allrounder',
    'Emerging_players'
];

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
    return 50; // Default
}

function normalizeRole(role) {
    if (!role) return 'Batsman';
    const r = role.toLowerCase().trim();
    if (r.includes('wicket')) return 'Wicketkeeper';
    if (r.includes('all-rounder') || r.includes('allrounder')) return 'All-Rounder';
    if (r.includes('batsman') || r.includes('batsmen') || r.includes('batter')) return 'Batsman';
    if (r.includes('bowler')) return 'Bowler';
    return 'Batsman';
}

function getDetailedPoolOrder(poolName, role) {
    let pName = (poolName || '').toLowerCase().trim();
    let rName = (role || '').toLowerCase().trim();

    let standardName = pName;
    if (pName === 'marqueeset' || pName.includes('marquee')) {
        if (rName.includes('wicket') || rName === 'wk') standardName = 'marquee_wk';
        else if (rName.includes('bat')) standardName = 'marquee_batsmen';
        else if (rName.includes('bowl')) standardName = 'marquee_bowlers';
        else if (rName.includes('all')) standardName = 'marquee_allrounder';
    } else if (pName === 'pool1' || pName.startsWith('pool1_')) {
        if (rName.includes('wicket') || rName === 'wk') standardName = 'pool1_wk';
        else if (rName.includes('bat')) standardName = 'pool1_batsmen';
        else if (rName.includes('bowl')) standardName = 'pool1_bowlers';
        else if (rName.includes('all')) standardName = 'pool1_allrounders';
    } else if (pName === 'pool2' || pName.startsWith('pool2_')) {
        if (rName.includes('bat')) standardName = 'pool2_batsmen';
        else if (rName.includes('bowl')) standardName = 'pool2_bowlers';
        else if (rName.includes('all')) standardName = 'pool2_allrounder';
    } else if (pName === 'pool3' || pName.startsWith('pool3_')) {
        standardName = 'pool3_batsmen';
    } else if (pName === 'pool4' || pName.startsWith('pool4_')) {
        if (rName.includes('wicket') || rName === 'wk') standardName = 'pool4_wk';
        else if (rName.includes('bat')) standardName = 'pool4_batsmen';
        else if (rName.includes('all')) standardName = 'pool4_allrounder';
    } else if (pName.includes('emerging')) {
        standardName = 'emerging_players';
    }

    const pIdx = PLAYER_COLLECTIONS.findIndex(col => col.toLowerCase() === standardName);
    
    // Fallback if not an exact match
    if (pIdx === -1) {
        if (pName.includes('marquee')) return 1;
        if (pName.includes('pool1')) return 6;
        if (pName.includes('pool2')) return 11;
        if (pName.includes('pool3')) return 13;
        if (pName.includes('pool4')) return 15;
        if (pName.includes('emerging')) return 17;
        return 99;
    }

    return pIdx + 1; // 1-indexed for logical sorting
}

const consolidatePlayers = async () => {
    try {
        const playerCount = await Player.countDocuments();
        
        // --- ROBUST: Re-verify strict sequence for all players ---
        if (playerCount > 0) {
            console.log(`>>> Player collection has ${playerCount} documents. Verifying strict sequence...`);
            
            const allPlayers = await Player.find({}, 'poolName role poolOrder').lean();
            const bulkOps = [];

            for (const p of allPlayers) {
                const expectedOrder = getDetailedPoolOrder(p.poolName, p.role);

                if (p.poolOrder !== expectedOrder) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: p._id },
                            update: { $set: { poolOrder: expectedOrder } }
                        }
                    });
                }
            }

            if (bulkOps.length > 0) {
                console.log(`>>> Updating ${bulkOps.length} players to match the strict collection sequence...`);
                await Player.bulkWrite(bulkOps);
                console.log('>>> Strict sequence alignment complete.');
            } else {
                console.log('>>> All players are already perfectly sorted.');
            }

            // DEBUG: Log the first 10 players from fetchAllPlayers to verify order
            const PlayerService = require('../models/Player'); 
            const samples = await PlayerService.find().sort({ poolOrder: 1, createdAt: 1 }).limit(10).lean();
            console.log(">>> AUCTION ORDER PREVIEW (Top 10):");
            samples.forEach((s, i) => console.log(` [${i+1}] ${s.player || s.name} | Pool: ${s.poolName} | Order: ${s.poolOrder}`));

            return;
        }

        console.log('>>> Player collection is empty. Attempting to consolidate from pool collections...');
        const db = mongoose.connection.db;
        let allPlayers = [];

        // Dynamically discover all collections in the database to prevent spelling/casing misses
        const allCollections = await db.listCollections().toArray();
        const nonPoolCollections = ['users', 'rooms', 'auctionrooms', 'franchises', 'players', 'new_enhanced', 'auctiontransactions', 'system.indexes'];
        
        const candidatePools = allCollections
            .map(c => c.name)
            .filter(name => !nonPoolCollections.includes(name.toLowerCase()));

        console.log(`>>> Found ${candidatePools.length} potential pool collections to scan...`);

        for (const colName of candidatePools) {
            try {
                const raw = await db.collection(colName).find({}).toArray();
                if (raw.length === 0) continue;

                console.log(` - ${colName}: found ${raw.length} players`);
                
                const mapped = raw.map((doc, idx) => {
                    const nationality = doc.nationality || 'Unknown';
                    const isOverseas = !(['india', 'indian'].includes(nationality.toLowerCase().trim()));
                    const playerName = doc.player || doc.Player || doc.name || 'Unknown Player';
                    const role = normalizeRole(doc.role);
                    const pOrder = getDetailedPoolOrder(colName, role); // Uses robust fuzzy matching

                    return {
                        playerId: `PLY_${colName}_${idx}_${Date.now()}`,
                        name: playerName,
                        player: playerName,
                        role: role,
                        nationality: nationality,
                        isOverseas: isOverseas,
                        basePrice: getBasePriceFromPool(colName),
                        poolName: colName,
                        poolOrder: pOrder,
                        photoUrl: doc.image_path || doc.imagepath || `https://i.pravatar.cc/150?u=${encodeURIComponent(playerName.replace(/\s/g, ''))}`,
                        stats: {
                            matches: Number(doc.matches) || 0,
                            runs: Number(doc.runs) || 0,
                            wickets: Number(doc.wickets) || 0,
                            battingAvg: Number(doc.batting_avg) || Number(doc.bat_avg) || 0,
                            bowlingAvg: Number(doc.bowling_avg) || Number(doc.bowl_avg) || 0,
                            strikeRate: Number(doc.batting_strike_rate) || Number(doc.strike_rate) || 0,
                            economy: Number(doc.bowling_economy) || Number(doc.economy) || 0,
                            highestScore: String(doc.highest_score || doc.hs || '0'),
                            bestBowling: String(doc.best_bowling || doc.bb || doc.best_bowling_figures || '0/0'),
                            stumpings: Number(doc.stumpings) || 0,
                            catches: Number(doc.catches) || 0,
                            iplSeasonsActive: Math.max(1, Math.floor((Number(doc.matches) || 0) / 14))
                        }
                    };
                });
                allPlayers = allPlayers.concat(mapped);
            } catch (colErr) {
                // Collection might not exist or be accessible
                continue;
            }
        }

        // Non-destructive healing: check what we already have
        const existingDocs = await Player.find({}, 'name player').lean();
        const existingNames = new Set(existingDocs.map(d => (d.name || d.player || '').toLowerCase().trim()));

        const missingPlayers = allPlayers.filter(p => !existingNames.has(p.player.toLowerCase().trim()));

        if (missingPlayers.length > 0) {
            console.log(`>>> Found ${missingPlayers.length} missing players! Inserting them into 'new_enhanced'...`);
            await Player.insertMany(missingPlayers);
            console.log('>>> Missing players recovered successfully!');
        } else {
            console.log('>>> All players are fully populated. No missing players detected.');
        }

    } catch (error) {
        console.error('>>> Error during player consolidation:', error.message);
    }
};

module.exports = consolidatePlayers;

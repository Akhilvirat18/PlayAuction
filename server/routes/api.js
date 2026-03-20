const express = require('express');
const router = express.Router();
const AuctionRoom = require('../models/AuctionRoom');
const { evaluateAllTeams } = require('../services/aiRating');

router.get('/room/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/room/:roomCode/results', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode }).populate('franchisesInRoom.playersAcquired.player');

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.status !== 'Finished') {
            return res.status(400).json({ error: 'Auction is not finished yet' });
        }

        // Return pre-calculated results from DB
        res.json({ teams: room.franchisesInRoom });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error generating results' });
    }
});

router.get('/players', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const AUCTION_POOL_ORDER = [
            'marquee_wicketkeepers', 'marquee_batters', 'marquee_bowlers', 'marquee_allrounders',
            'pool1_wicketkeepers', 'pool1_batters', 'pool1_bowlers', 'pool1_allrounders',
            'pool2_wicketkeepers', 'pool2_batters', 'pool2_bowlers', 'pool2_allrounders',
            'pool3_wicketkeepers', 'pool3_batters', 'pool3_bowlers', 'pool3_allrounders',
            'Emerging_players'
        ];
        const db = mongoose.connection.db;
        const existingCollections = await db.listCollections().toArray();
        const existingNames = existingCollections.map(c => c.name);
        let allPlayers = [];
        for (const poolName of AUCTION_POOL_ORDER) {
            const actualName = existingNames.find(n => n.toLowerCase() === poolName.toLowerCase());
            if (!actualName) continue;
            const docs = await db.collection(actualName).find({}).toArray();
            allPlayers = allPlayers.concat(docs.map(d => ({ ...d, poolName: actualName })));
        }
        res.json(allPlayers);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

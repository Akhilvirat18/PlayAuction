const mongoose = require('mongoose');

const auctionRoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    hostSocketId: { type: String }, // For legacy engine reference
    status: { type: String, enum: ["Lobby", "Auctioning", "Selection", "Finished"], default: "Lobby" },
    isPublic: { type: Boolean, default: false },
    maxTeams: { type: Number, default: 10 },
    purseLimit: { type: Number, default: 12000 },

    // Embedded array of franchises inside this specific room
    franchisesInRoom: [{
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
        teamName: { type: String },
        teamThemeColor: { type: String },
        ownerSocketId: { type: String },
        ownerName: { type: String },
        currentPurse: { type: Number, default: 12000 },
        overseasCount: { type: Number, default: 0 },
        rtmUsed: { type: Boolean, default: false },
        playersAcquired: [{
            player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
            name: { type: String },
            isOverseas: { type: Boolean, default: false },
            boughtFor: { type: Number }
        }],
        playing15: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
        evaluation: { type: Object }, // Store detailed AI results
        rank: { type: Number }         // Store final ranking
    }],

    currentPlayerIndex: { type: Number, default: 0 },
    unsoldPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],

    // Core bidding state
    currentBidAmount: { type: Number, default: 0 },
    highestBidderSocketId: { type: String, default: null },
    highestBidderTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise', default: null },

}, { timestamps: true });

module.exports = mongoose.model('AuctionRoom', auctionRoomSchema);

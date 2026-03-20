const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerId: { type: String, unique: true },
  name: { type: String },
  player: { type: String }, // Actual field in new_enhanced collection
  role: { type: String, enum: ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper", "Batsmen", "Allrounder"] },
  nationality: { type: String },
  isOverseas: { type: Boolean, default: false },
  basePrice: { type: Number, default: 50 },
  photoUrl: { type: String },
  imagepath: { type: String },
  image_path: { type: String },
  poolName: { type: String },
  poolOrder: { type: Number, default: 99 }, // NEW: Priority for auction order
  stats: {
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    battingAvg: { type: Number, default: 0 },
    bowlingAvg: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    highestScore: { type: String, default: '0' },
    bestBowling: { type: String, default: '0/0' },
    iplSeasonsActive: { type: Number, default: 0 }
  }
}, { timestamps: true });

playerSchema.index({ "role": 1 });

module.exports = mongoose.model('Player', playerSchema, 'new_enhanced');

const mongoose = require('mongoose');

const drawSchema = new mongoose.Schema({
  drawNumber: { type: Number, required: true, unique: true }, //
  drawDate: { type: String, required: true }, // Format: YYYY-MM-DD
  startTime: { type: Date, required: true }, // PKT Time
  endTime: { type: Date, required: true }, // PKT Time
  totalRevenue: { type: Number, default: 0 }, //
  winningNumber: { type: String, required: true }, //
  raffleType: { type: String, default: 'daily' }, //
  status: { type: String, enum: ['pending', 'completed'], default: 'completed' } //
}, { timestamps: true });

module.exports = mongoose.model('Draw', drawSchema);
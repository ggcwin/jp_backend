const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chosenNumbers: [{ type: String, required: true }], 
    positions: [{ type: Number }], 
    // ✨ FIX: Yahan '1one' ko '1won' kar diya hai
    gameType: { type: String, enum: ['4tune', '3luck', '2win', '1won'], required: true }, 
    isStraight: { type: Boolean, default: false }, 
    isMixFix: { type: Boolean, default: false }, 
    price: { type: Number, default: 0.035 }, 
    status: { type: String, enum: ['pending', 'won', 'lost'], default: 'pending' },
    wonPrize: { type: Number, default: 0 },
    drawNumber: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
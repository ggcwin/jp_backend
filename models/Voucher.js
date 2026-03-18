const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ✨ FIX
    creatorRole: { type: String, enum: ['admin', 'user'], required: true }, // ✨ FIX
    status: { type: String, enum: ['active', 'redeemed'], default: 'active' },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    redeemedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);
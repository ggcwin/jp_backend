const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 }, // ✨ FIX: 10% Fee
    finalAmount: { type: Number, required: true }, // ✨ FIX: Fee katne ke baad wali amount
    method: { type: String, required: true }, 
    accountDetails: { type: String, required: true }, 
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Withdraw', withdrawSchema);
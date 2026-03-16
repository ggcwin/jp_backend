const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true }, // e.g., 'USDT (TRC20)', 'JazzCash', 'Paytm'
    accountDetails: { type: String, required: true }, // Wallet address ya phone number
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Withdraw', withdrawSchema);
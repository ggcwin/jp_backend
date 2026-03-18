const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        // ✨ FIX: 'refund' add kiya taake app crash na ho
        enum: ['deposit', 'withdraw', 'transfer_send', 'transfer_receive', 'Transfer Send', 'Transfer Receive', 'win', 'reward', 'purchase', 'ticket_buy', 'refund'], 
        required: true 
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    details: { type: String }, 
    slipUrl: { type: String, default: null }, // ✨ FIX: Deposit Screenshot upload support
    date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
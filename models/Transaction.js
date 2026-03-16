const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        // ✅ Yahan 'purchase', 'Transfer Send', aur 'Transfer Receive' add kar diya gaya hai
        enum: ['deposit', 'withdraw', 'transfer_send', 'transfer_receive', 'Transfer Send', 'Transfer Receive', 'win', 'reward', 'purchase'], 
        required: true 
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    status: { type: String, default: 'completed' }, // withdraw ke liye 'pending' ho sakta hai
    details: { type: String }, // e.g., "Sent to ali123" ya "Lucky Draw Win"
    date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
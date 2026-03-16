const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, immutable: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    fullName: String,
    phone: String,
    dob: { type: String, required: true }, // ✨ NAYA: Date of Birth add kar di
    role: { type: String, default: 'user' }, 
    wallets: {
        deposit: { type: Number, default: 0 },
        win: { type: Number, default: 0 },
        reward: { type: Number, default: 0.05 } 
    },
    totalEarning: { type: Number, default: 0 },
    ipAddress: { type: String, default: null },

    // --- REFERRAL SYSTEM ---
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 }
    
}, { timestamps: true });

module.exports = mongoose.model('User', usersSchema);
const Voucher = require('../models/Voucher');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// 1. Admin ke liye voucher banana
exports.createVoucher = async (req, res) => {
    try {
        const { amount } = req.body;
        // Random unique code generate karein
        const code = 'GGC-' + amount + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const newVoucher = new Voucher({ code, amount });
        await newVoucher.save();
        
        res.status(201).json({ message: 'Voucher Created Successfully!', code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. User ke liye balance load karna
exports.redeemVoucher = async (req, res) => {
    try {
        const { username, code } = req.body;
        const voucher = await Voucher.findOne({ code, isUsed: false });
        
        if (!voucher) return res.status(400).json({ message: 'Invalid or Already Used Voucher!' });

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found!' });

        // Balance update karein
        user.wallets.deposit += voucher.amount;
        
        // Voucher status update karein
        voucher.isUsed = true;
        voucher.usedBy = user._id;
        
        await user.save();
        await voucher.save();

        // Transaction history mein entry dalein
        const transaction = new Transaction({
            userId: user._id,
            type: 'deposit',
            amount: voucher.amount,
            description: `Voucher Redeemed: ${code}`
        });
        await transaction.save();

        res.status(200).json({ message: 'Balance Loaded!', newBalance: user.wallets.deposit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
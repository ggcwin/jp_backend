const router = require('express').Router();
const Voucher = require('../models/Voucher'); 
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

router.get('/', async (req, res) => {
    try {
        const vouchers = await Voucher.find()
            .sort({ createdAt: -1 })
            .populate('usedBy', 'username'); 
        res.status(200).json(vouchers);
    } catch (err) {
        res.status(500).json({ message: "Error fetching vouchers" });
    }
});

router.post('/generate', async (req, res) => {
    try {
        const { amount, count } = req.body;
        let generatedVouchers = [];

        for (let i = 0; i < count; i++) {
            const code = "GGC-" + crypto.randomBytes(4).toString('hex').toUpperCase();
            const newVoucher = new Voucher({ code: code.trim(), amount, status: 'active' }); 
            await newVoucher.save();
            generatedVouchers.push(newVoucher);
        }

        res.status(201).json(generatedVouchers);
    } catch (err) {
        res.status(500).json({ message: "Voucher generation failed" });
    }
});

router.post('/redeem', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        if (!code) return res.status(400).json({ message: "Please enter a voucher code!" });

        const cleanCode = code.toUpperCase().trim();

        const voucher = await Voucher.findOne({ 
            code: { $regex: new RegExp(`^\\s*${cleanCode}\\s*$`, 'i') }
        });
        
        if (!voucher) return res.status(400).json({ message: "Invalid voucher code!" });
        
        if (voucher.status === 'used' || voucher.status === 'Redeemed' || voucher.usedBy) {
            return res.status(400).json({ message: "This voucher has already been redeemed!" });
        }
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        voucher.status = 'used';
        voucher.usedBy = user._id;
        voucher.usedAt = new Date();
        await voucher.save(); 

        user.wallets.deposit += voucher.amount;
        await user.save();

        // ✨ FIX: History log mein Rs. lagaya
        await Transaction.create({
            userId: user._id, type: 'deposit', amount: voucher.amount, netAmount: voucher.amount,
            details: `🎟️ Redeemed Promo Code: ${cleanCode} for Rs. ${voucher.amount}`, status: 'completed'
        });

        // ✨ FIX: Success message mein Rs.
        res.status(200).json({ 
            message: `Success! Rs. ${voucher.amount} added to your account.`,
            amount: voucher.amount,
            walletType: 'deposit',
            newBalance: user.wallets.deposit
        });
    } catch (err) {
        console.error("Redeem Error:", err);
        res.status(500).json({ message: "Error redeeming voucher" });
    }
});

module.exports = router;
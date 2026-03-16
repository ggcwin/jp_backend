const router = require('express').Router();
const Voucher = require('../models/Voucher'); 
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

// 👑 ADMIN: Load Vouchers with Username
router.get('/', async (req, res) => {
    try {
        // .populate('usedBy') se hum database se user ka naam sath nikal rahe hain
        const vouchers = await Voucher.find()
            .sort({ createdAt: -1 })
            .populate('usedBy', 'username'); 
        res.status(200).json(vouchers);
    } catch (err) {
        res.status(500).json({ message: "Error fetching vouchers" });
    }
});

// 👑 ADMIN: Generate New Vouchers
router.post('/generate', async (req, res) => {
    try {
        const { amount, count } = req.body;
        let generatedVouchers = [];

        for (let i = 0; i < count; i++) {
            const code = "GGC-" + crypto.randomBytes(4).toString('hex').toUpperCase();
            // Database ke hisaab se status 'active' rakha hai
            const newVoucher = new Voucher({ code: code.trim(), amount, status: 'active' }); 
            await newVoucher.save();
            generatedVouchers.push(newVoucher);
        }

        res.status(201).json(generatedVouchers);
    } catch (err) {
        res.status(500).json({ message: "Voucher generation failed" });
    }
});

// 👤 USER: Redeem Voucher
router.post('/redeem', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        if (!code) return res.status(400).json({ message: "Please enter a voucher code!" });

        const cleanCode = code.toUpperCase().trim();

        const voucher = await Voucher.findOne({ 
            code: { $regex: new RegExp(`^\\s*${cleanCode}\\s*$`, 'i') }
        });
        
        if (!voucher) return res.status(400).json({ message: "Invalid voucher code!" });
        
        // 🛑 STRICT BULLETPROOF LOCK: Agar status used hai YA usedBy mein kisi ki ID hai
        if (voucher.status === 'used' || voucher.status === 'Redeemed' || voucher.usedBy) {
            return res.status(400).json({ message: "This voucher has already been redeemed!" });
        }
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        // ✅ FIX: Pehle VOUCHER ko used mark karein aur save karein!
        voucher.status = 'used';
        voucher.usedBy = user._id;
        voucher.usedAt = new Date();
        await voucher.save(); // Agar ye fail hua, toh aage paise nahi milenge!

        // Uske baad user ke wallet mein paise dalen
        user.wallets.deposit += voucher.amount;
        await user.save();

        // History Create karein
        await Transaction.create({
            userId: user._id,
            type: 'deposit',
            amount: voucher.amount,
            netAmount: voucher.amount,
            details: `🎟️ Redeemed Promo Code: ${cleanCode}`,
            status: 'completed'
        });

        res.status(200).json({ 
            message: `Success! $${voucher.amount} added to your account.`,
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
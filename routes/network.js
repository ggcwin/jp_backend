const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// 🛡️ Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ success: false, message: 'Access Denied!' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid Token!' });
    }
};

// 👥 GET: My Network Stats API
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // 1. Direct Referrals (Level 1) dhoondo
        const referrals = await User.find({ referredBy: user._id }).select('username createdAt wallets');

        // 2. Team Commission Calculate karo (Transaction history se 'Referral Win' wale check karo)
        const teamEarningsTx = await Transaction.find({
            userId: user._id,
            type: 'win',
            details: { $regex: /Referral/i } // 'Referral Win' ya 'G-Referral Win' dono pakray ga
        });

        const totalTeamEarnings = teamEarningsTx.reduce((sum, tx) => sum + tx.amount, 0);

        res.status(200).json({
            success: true,
            inviteCode: user.username.toUpperCase(), // Username ko hi referral code use kar rahe hain
            totalReferrals: referrals.length,
            totalEarnings: totalTeamEarnings,
            referrals: referrals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
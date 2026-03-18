const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const walletController = require('../controllers/walletController');
const Withdraw = require('../models/Withdraw');

const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Invalid Token!' }); }
};

// ✨ Controllers (Nayi 10% Fee Logic)
router.post('/request', auth, walletController.requestWithdraw);
router.post('/action', auth, walletController.updateWithdrawStatus);

// 📊 History Routes
router.get('/history/:userId', auth, async (req, res) => {
    try {
        const history = await Withdraw.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) { res.status(500).json({ message: "Error fetching history" }); }
});

router.get('/all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access only!' });
        const requests = await Withdraw.find().populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (err) { res.status(500).json({ message: "Admin access error" }); }
});

module.exports = router;
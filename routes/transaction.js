const router = require('express').Router();
const Transaction = require('../models/Transaction');

// ✅ FIXED: Frontend ab '/api/transaction/history/ID' mang raha hai
router.get('/history/:userId', async (req, res) => {
    try {
        const history = await Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
});

// User ki saari history mangwana (Backup route)
router.get('/:userId', async (req, res) => {
    try {
        const history = await Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
});

// Global history mangwana (Admin ke liye)
router.get('/', async (req, res) => {
    try {
        const history = await Transaction.find().sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
});

module.exports = router;
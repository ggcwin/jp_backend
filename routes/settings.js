const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const settingsController = require('../controllers/settingsController');

const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Invalid Token!' }); }
};

// ✨ Naye Bank aur Telegram Link model ke controller se attached
router.get('/financial', auth, settingsController.getFinancialSettings);
router.post('/financial', auth, settingsController.updateFinancialSettings);

module.exports = router;
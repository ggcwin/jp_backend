const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const adminController = require('../controllers/adminController');

// 🛡️ Middleware: Auth & Admin Security Check
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access only!' });
        next();
    } catch (e) { res.status(400).json({ message: 'Invalid Token!' }); }
};

// 👥 VIP USER & SYSTEM MANAGEMENT (Secured)
router.get('/locked-users', auth, adminController.getLockedUsers);
router.post('/unblock', auth, adminController.unblockUser);
router.get('/draw-settings', auth, adminController.getDrawSettings);
router.post('/draw-settings', auth, adminController.updateDrawSettings);
router.get('/ticket-stats', auth, adminController.getTicketStats);
router.get('/users', auth, adminController.getAllUsers);
router.post('/user/change-password', auth, adminController.changeUserPassword);
router.post('/user/adjust-balance', auth, adminController.adjustUserBalance);
router.post('/user/login-as', auth, adminController.loginAsUser);
router.get('/ledger', auth, adminController.getGlobalLedger);
router.post('/risk-analysis', auth, adminController.getRiskAnalysis);

module.exports = router;
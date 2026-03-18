const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const voucherController = require('../controllers/voucherController');

const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Invalid Token!' }); }
};

const adminAuth = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access only!' });
    next();
};

// ✨ Pointing to Voucher Controller
router.post('/create', auth, voucherController.createVoucher);
router.post('/redeem', auth, voucherController.redeemVoucher);
router.get('/admin/all', auth, adminAuth, voucherController.getAdminVouchers);

module.exports = router;
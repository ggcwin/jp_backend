const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const walletController = require('../controllers/walletController');
const Transaction = require('../models/Transaction');

// 📁 Uploads folder check & create
const uploadDir = './uploads/deposits/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 📸 Multer Storage Setup
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, 'slip-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 🛡️ Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ success: false, message: 'Access Denied! No token provided.' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid Token!' });
    }
};

// --- EXISTING ROUTES ---
router.get('/history/:username', walletController.getTransactionHistory);
router.post('/withdraw-request', auth, walletController.requestWithdraw);
router.post('/admin/withdraw-update', auth, walletController.updateWithdrawStatus);

// ==========================================
// 🚀 NAYE ROUTES (Secure Deposit System) 🚀
// ==========================================

// ✨ User: Deposit Request Bhejna (Image Slip ke sath)
router.post('/deposit-request', auth, upload.single('slip'), async (req, res) => {
    try {
        const { amount, method, trxId } = req.body;
        const slipUrl = req.file ? `/uploads/deposits/${req.file.filename}` : 'No Slip Attached';
        
        await Transaction.create({
            userId: req.user.id,
            type: 'deposit',
            amount: Number(amount),
            details: `Method: ${method} | TRX: ${trxId} | Slip: ${slipUrl}`,
            status: 'Pending'
        });

        res.status(200).json({ success: true, message: 'Request sent successfully! ✅' });
    } catch (err) { 
        res.status(500).json({ success: false, message: "Error submitting deposit." }); 
    }
});

router.get('/admin/pending-deposits', walletController.getPendingDeposits);
router.post('/admin/approve-deposit', walletController.approveDeposit);

module.exports = router;
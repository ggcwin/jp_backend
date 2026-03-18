const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const walletController = require('../controllers/walletController');
const Transaction = require('../models/Transaction'); // Direct DB access ke liye

// 📁 Uploads folder check & create (Taake app crash na ho)
const uploadDir = './uploads/deposits/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 📸 Multer Storage Setup (Image save karne ka mechanism)
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, 'slip-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 🛡️ Auth Middleware (User ko verify karne ke liye)
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

// --- EXISTING ROUTES (Aap ke purane) ---
// 1. Transaction History dekhna
router.get('/history/:username', walletController.getTransactionHistory);

// 2. User: Withdraw Request bhejna
router.post('/withdraw-request', walletController.requestWithdraw);

// 3. Admin: Withdraw Status Update karna
router.post('/admin/withdraw-update', walletController.updateWithdrawStatus);


// ==========================================
// 🚀 NAYE ROUTES (Secure Deposit System) 🚀
// ==========================================

// ✨ 4. User: Deposit Request Bhejna (Image Slip + TRC20 Hash ke sath)
router.post('/deposit-request', auth, upload.single('slip'), async (req, res) => {
    try {
        const { amount, method, trxId } = req.body;
        
        // Agar file aayi hai toh uska URL banayen, warna khali chor dein
        const slipUrl = req.file ? `/uploads/deposits/${req.file.filename}` : 'No Slip Attached';
        
        // Transaction Database mein Pending status se save karein
        await Transaction.create({
            userId: req.user.id,
            type: 'deposit',
            amount: Number(amount),
            details: `Method: ${method} | TRX: ${trxId} | Slip: ${slipUrl}`,
            status: 'Pending'
        });

        res.status(200).json({ success: true, message: 'Request sent successfully! ✅' });
    } catch (err) { 
        console.error("Deposit Error:", err);
        res.status(500).json({ success: false, message: "Error submitting deposit." }); 
    }
});

// 5. Admin: Saari Pending Deposit Requests dekhna
router.get('/admin/pending-deposits', walletController.getPendingDeposits);

// 6. Admin: Deposit Approve karna (Safe tareeqay se)
router.post('/admin/approve-deposit', walletController.approveDeposit);

module.exports = router;
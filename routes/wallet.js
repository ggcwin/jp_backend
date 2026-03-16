const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

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

// 4. User: Deposit Request Bhejna (TRC20 Hash ke sath)
router.post('/deposit-request', walletController.requestDeposit);

// 5. Admin: Saari Pending Deposit Requests dekhna
router.get('/admin/pending-deposits', walletController.getPendingDeposits);

// 6. Admin: Deposit Approve karna (Safe tareeqay se)
router.post('/admin/approve-deposit', walletController.approveDeposit);

module.exports = router;
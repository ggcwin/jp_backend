const router = require('express').Router();
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Transaction = require('../models/Transaction');

// --- 1. USER: Nayi Withdrawal Request Bhejna (Rs. 500 Min + 15% Fee) ---
router.post('/request', async (req, res) => {
    try {
        const { userId, amount, method, accountDetails, walletType } = req.body;

        // A. Decimal khatam karna aur Minimum Check (Rs. 500)
        const cleanAmount = Math.floor(Number(amount));
        if (cleanAmount < 500) {
            return res.status(400).json({ message: "Minimum withdrawal is Rs. 500 (No Decimals)" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        // B. Wallet Balance Check
        if (!user.wallets[walletType] || user.wallets[walletType] < cleanAmount) {
            return res.status(400).json({ message: `Insufficient balance in ${walletType} wallet!` });
        }

        // C. 15% Policy aur Calculations
        const fee = cleanAmount * 0.15;
        const finalAmountToUser = cleanAmount - fee;

        // D. Transaction Atomic (Wallets se deduct karna)
        user.wallets[walletType] -= cleanAmount;
        await user.save();

        // E. Withdrawal Record Save karna
        const newRequest = new Withdraw({
            userId, amount: cleanAmount, fee: fee, finalAmount: finalAmountToUser,
            method, accountDetails, walletType, status: 'Pending'
        });
        await newRequest.save();

        // F. Global History Log
        await Transaction.create({
            userId, type: 'withdraw', amount: cleanAmount, fee: fee, netAmount: finalAmountToUser,
            status: 'pending', details: `Withdrawal via ${method} from ${walletType} wallet`
        });

        res.status(201).json({
            message: "Request submitted! 15% fee applied.",
            newBalance: user.wallets[walletType]
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// --- 2. USER: Apni History Dekhna ---
router.get('/history/:userId', async (req, res) => {
    try {
        const history = await Withdraw.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
});

// --- 3. ADMIN: Sari Requests Dekhna (With Username) ---
router.get('/all', async (req, res) => {
    try {
        const requests = await Withdraw.find().populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (err) {
        res.status(500).json({ message: "Admin access error" });
    }
});

// --- 4. ADMIN: Request Approve ya Reject karna ---
router.post('/action', async (req, res) => {
    try {
        const { requestId, action } = req.body; 

        const request = await Withdraw.findById(requestId);
        if (!request) return res.status(404).json({ message: "Request not found!" });
        if (request.status !== 'Pending') return res.status(400).json({ message: "Already processed!" });

        request.status = action;
        await request.save();

        if (action === 'Rejected') {
            const user = await User.findById(request.userId);
            if (user) {
                const walletToRefund = request.walletType || 'win';
                user.wallets[walletToRefund] += request.amount;
                await user.save();

                await Transaction.findOneAndUpdate(
                    { userId: user._id, type: 'withdraw', amount: request.amount, status: 'pending' },
                    { status: 'rejected' }
                );
            }
        } else if (action === 'Approved') {
            await Transaction.findOneAndUpdate(
                { userId: request.userId, type: 'withdraw', amount: request.amount, status: 'pending' },
                { status: 'completed' }
            );
        }

        res.status(200).json({ message: `Success: Request has been ${action}!` });
    } catch (err) {
        res.status(500).json({ message: "Action failed", error: err.message });
    }
});

module.exports = router;
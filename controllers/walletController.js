const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Transaction = require('../models/Transaction');

// 1. Admin: Funds add karna (Admin Treasury se deduction)
exports.addFunds = async (req, res) => {
    try {
        const { targetUsername, amount } = req.body;
        const numAmount = Number(amount);

        if (!numAmount || numAmount <= 0) return res.status(400).json({ message: "Invalid amount!" });

        const admin = await User.findOne({ role: 'admin' });
        if (!admin || admin.wallets.deposit < numAmount) {
            return res.status(400).json({ message: "Insufficient Treasury balance!" });
        }

        const user = await User.findOne({ username: targetUsername });
        if (!user) return res.status(404).json({ message: 'User not found!' });

        admin.wallets.deposit -= numAmount;
        user.wallets.deposit += numAmount;

        await admin.save();
        await user.save();

        await new Transaction({
            userId: user._id,
            type: 'deposit',
            amount: numAmount,
            details: 'Funds added by Admin from Treasury',
            status: 'completed'
        }).save();

        res.status(200).json({ message: `Added $${numAmount} to ${targetUsername}` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. User: Transaction History
exports.getTransactionHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found!' });
        const history = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. User: Withdraw Request (With 10% Fee Logic)
exports.requestWithdraw = async (req, res) => {
    try {
        const { username, amount, method, walletAddress } = req.body;
        const user = await User.findOne({ username });
        const numAmount = Math.floor(Number(amount)); // Decimal removal

        if (numAmount <= 0) return res.status(400).json({ message: "Invalid amount" });

        // 🎯 10% Fee Calculation
        const fee = numAmount * 0.10;
        const totalNeeded = numAmount + fee;

        if (!user || user.wallets.win < totalNeeded) {
            return res.status(400).json({ 
                message: `Insufficient balance! Total required: $${totalNeeded.toFixed(2)} (including 10% fee).` 
            });
        }
        
        // Deduction (Amount + Fee)
        user.wallets.win -= totalNeeded;
        await user.save();
        
        const newReq = new Withdraw({ 
            userId: user._id, 
            amount: numAmount, 
            fee: fee, 
            method, 
            walletAddress 
        });
        await newReq.save(); 
        
        res.status(201).json({ message: `Withdrawal requested. $${fee.toFixed(2)} fee deducted.` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 4. Admin: Withdraw Status Update
exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { requestId, status } = req.body;
        const request = await Withdraw.findById(requestId).populate('userId');
        if (!request) return res.status(404).json({ message: 'Not found' });
        
        if (status === 'approved') {
            request.status = 'approved';
            await new Transaction({ 
                userId: request.userId._id, 
                type: 'withdraw', 
                amount: request.amount, 
                details: `Withdrawal Approved (Fee: $${request.fee || 0})` 
            }).save();
        } else {
            request.status = 'rejected';
            // Return Total (Amount + Fee) on rejection
            const refundAmount = request.amount + (request.fee || 0);
            request.userId.wallets.win += refundAmount;
            await request.userId.save();
        }
        await request.save();
        res.status(200).json({ message: `Withdrawal ${status}` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 5. User: Deposit Request
exports.requestDeposit = async (req, res) => {
    try {
        const { userId, amount, trxHash } = req.body;
        await new Transaction({
            userId, 
            type: 'deposit',
            amount: Number(amount),
            details: `TRC20 Hash: ${trxHash}`,
            status: 'pending' 
        }).save();
        res.status(200).json({ message: "Deposit request sent!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// 6. Admin: Pending Deposits
exports.getPendingDeposits = async (req, res) => {
    try {
        const pending = await Transaction.find({ type: 'deposit', status: 'pending' })
            .populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(pending);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// 7. Admin: Deposit Approve
exports.approveDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body; 
        const depositRequest = await Transaction.findById(transactionId);
        if (!depositRequest || depositRequest.status !== 'pending') return res.status(400).json({ message: "Invalid request" });

        const targetUser = await User.findById(depositRequest.userId);
        targetUser.wallets.deposit += depositRequest.amount;
        await targetUser.save();

        depositRequest.status = 'completed';
        await depositRequest.save();

        res.status(200).json({ message: "Deposit Approved" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 8. USER: TRANSFER FUNDS (3% Sender Fee + Whole Number Logic)
exports.transferFunds = async (req, res) => {
    try {
        let { receiverUsername, amount, walletType } = req.body;
        const senderId = req.user.id; 

        // 🎯 Decimal Removal
        const cleanAmount = Math.floor(Number(amount));
        if (cleanAmount <= 0) return res.status(400).json({ message: "Please enter a valid whole number!" });

        const sender = await User.findById(senderId);
        const receiver = await User.findOne({ username: receiverUsername });

        if (!receiver) return res.status(404).json({ message: "Receiver not found!" });
        if (sender.username === receiverUsername) return res.status(400).json({ message: "Cannot send to yourself!" });

        // 🎯 3% Fee (Sender side)
        const fee = cleanAmount * 0.03; 
        const totalDeduction = cleanAmount + fee;

        if (sender.wallets[walletType] < totalDeduction) {
            return res.status(400).json({ 
                message: `Insufficient balance! Total cost: $${totalDeduction.toFixed(2)} (including 3% fee).` 
            });
        }

        // Wallets Update
        sender.wallets[walletType] -= totalDeduction; 
        receiver.wallets.deposit += cleanAmount; 

        await sender.save();
        await receiver.save();

        // Ledger Entries
        await new Transaction({
            userId: sender._id,
            type: 'Transfer Send',
            amount: cleanAmount,
            details: `Sent to ${receiverUsername} | Fee: $${fee.toFixed(2)}`,
            status: 'completed'
        }).save();

        await new Transaction({
            userId: receiver._id,
            type: 'Transfer Receive',
            amount: cleanAmount,
            details: `Received from ${sender.username}`,
            status: 'completed'
        }).save();

        res.status(200).json({ message: "Transfer successful!", feeCharged: fee });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Transaction = require('../models/Transaction');

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

        res.status(200).json({ message: `Added Rs. ${numAmount} to ${targetUsername}` }); 
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getTransactionHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found!' });
        const history = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// ✨ 10% WITHDRAW FEE LOGIC
exports.requestWithdraw = async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        const withdrawAmount = Number(amount);

        if (!withdrawAmount || withdrawAmount < 500) return res.status(400).json({ success: false, message: 'Minimum withdrawal is Rs. 500!' });

        const user = await User.findById(req.user.id);
        
        const fee = withdrawAmount * 0.10;
        const finalAmount = withdrawAmount - fee; 

        if (user.wallets.win < withdrawAmount) {
            return res.status(400).json({ success: false, message: `Insufficient Win Balance!` });
        }

        user.wallets.win -= withdrawAmount;
        await user.save();

        const withdrawReq = await Withdraw.create({
            userId: user._id, amount: withdrawAmount, fee: fee, finalAmount: finalAmount,
            method: method, accountDetails: accountDetails, status: 'Pending'
        });

        await Transaction.create({
            userId: user._id, type: 'withdraw', amount: withdrawAmount, netAmount: -withdrawAmount,
            details: `Withdraw Req: Rs. ${withdrawAmount} (Fee: Rs. ${fee.toFixed(2)})`, status: 'Pending'
        });

        res.status(200).json({ success: true, message: 'Withdraw request submitted! 10% fee applied.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { requestId, action } = req.body; 
        const withdrawReq = await Withdraw.findById(requestId);
        if (!withdrawReq || withdrawReq.status !== 'Pending') return res.status(400).json({ success: false, message: 'Invalid request' });

        withdrawReq.status = action;
        await withdrawReq.save();

        const user = await User.findById(withdrawReq.userId);

        if (action === 'Rejected' && user) {
            user.wallets.win += withdrawReq.amount; 
            await user.save();
            await Transaction.create({ userId: user._id, type: 'refund', amount: withdrawReq.amount, details: 'Withdraw Rejected Refund', status: 'completed' });
        } else if (action === 'Approved') {
            const adminAccount = await User.findOne({ role: 'admin' });
            if (adminAccount) {
                adminAccount.wallets.deposit += withdrawReq.fee; 
                await adminAccount.save();
            }
        }
        res.status(200).json({ success: true, message: `Withdraw request ${action}!` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPendingDeposits = async (req, res) => {
    try {
        const pending = await Transaction.find({ type: 'deposit', status: { $regex: /^pending$/i } })
            .populate('userId', 'username email').sort({ createdAt: -1 });
        res.status(200).json(pending);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body; 
        const depositRequest = await Transaction.findById(transactionId);
        if (!depositRequest || depositRequest.status.toLowerCase() !== 'pending') return res.status(400).json({ message: "Invalid request" });

        const targetUser = await User.findById(depositRequest.userId);
        targetUser.wallets.deposit += depositRequest.amount;
        await targetUser.save();

        depositRequest.status = 'completed';
        await depositRequest.save();

        res.status(200).json({ message: "Deposit Approved" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// ✨ 7% TRANSFER FEE & INVALID USER TRAP LOGIC
exports.transferFunds = async (req, res) => {
    try {
        let { receiverUsername, amount, walletType } = req.body;
        const senderId = req.user.id; 

        const cleanAmount = Math.floor(Number(amount));
        if (cleanAmount <= 0) return res.status(400).json({ message: "Please enter a valid whole number!" });

        const sender = await User.findById(senderId);
        const fee = cleanAmount * 0.07; // 7% Fee
        const totalDeduction = cleanAmount + fee;

        if (sender.wallets[walletType] < totalDeduction) {
            return res.status(400).json({ message: `Insufficient balance! Total cost: Rs. ${totalDeduction.toFixed(2)} (including 7% fee).` });
        }

        sender.wallets[walletType] -= totalDeduction; 
        await sender.save();
        
        await new Transaction({
            userId: sender._id, type: 'Transfer Send', amount: cleanAmount,
            details: `Sent to ${receiverUsername} | Fee: Rs. ${fee.toFixed(2)}`, status: 'completed'
        }).save();

        const receiver = await User.findOne({ username: { $regex: new RegExp(`^${receiverUsername}$`, 'i') } });
        const adminAccount = await User.findOne({ role: 'admin' });

        if (receiver) {
            // Valid Receiver
            receiver.wallets.deposit += cleanAmount; 
            await receiver.save();
            await new Transaction({
                userId: receiver._id, type: 'Transfer Receive', amount: cleanAmount,
                details: `Received from ${sender.username}`, status: 'completed'
            }).save();

            if (adminAccount) {
                adminAccount.wallets.deposit += fee;
                await adminAccount.save();
            }
        } else {
            // 🚨 INVALID USER TRAP: Full Amount + Fee goes to Admin!
            if (adminAccount) {
                adminAccount.wallets.deposit += totalDeduction;
                await adminAccount.save();
            }
        }

        res.status(200).json({ success: true, message: "Transfer successful!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
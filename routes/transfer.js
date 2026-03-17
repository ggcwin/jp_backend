const router = require('express').Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

router.post('/', async (req, res) => {
    try {
        const { senderId, receiverUsername, amount, walletType } = req.body;

        const transferAmount = Number(amount);
        if (!transferAmount || transferAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount!" });
        }

        const fee = transferAmount * 0.03;
        const totalDeduction = transferAmount + fee;

        const sender = await User.findById(senderId);
        if (!sender) return res.status(404).json({ message: "Sender not found!" });

        const receiver = await User.findOne({ username: receiverUsername.toLowerCase().trim() });
        if (!receiver) return res.status(404).json({ message: "Receiver not found!" });

        if (sender.username === receiver.username) {
            return res.status(400).json({ message: "You cannot send money to yourself!" });
        }

        // ✨ FIX: Error message mein Rs. 
        if (sender.wallets[walletType] < totalDeduction) {
            return res.status(400).json({ 
                message: `Insufficient balance! Total cost: Rs. ${totalDeduction.toFixed(2)} (including 3% fee).` 
            });
        }

        sender.wallets[walletType] -= totalDeduction;
        receiver.wallets.deposit += transferAmount; 

        await sender.save();
        await receiver.save();

        // ✨ FIX: Sender History mein Rs.
        await Transaction.create({
            userId: sender._id,
            type: 'transfer',
            amount: totalDeduction, 
            netAmount: totalDeduction,
            details: `💸 Sent Rs. ${transferAmount.toFixed(2)} to ${receiver.username} (Fee: Rs. ${fee.toFixed(2)})`,
            status: 'completed'
        });

        // ✨ FIX: Receiver History mein Rs.
        await Transaction.create({
            userId: receiver._id,
            type: 'deposit',
            amount: transferAmount,
            netAmount: transferAmount,
            details: `📥 Received Rs. ${transferAmount.toFixed(2)} from ${sender.username}`,
            status: 'completed'
        });

        const admin = await User.findOne({ role: 'admin' });
        if (admin) {
            admin.wallets.win += fee;
            await admin.save();
        }

        res.status(200).json({ 
            message: "Transfer Successful!", 
            newBalance: sender.wallets[walletType] 
        });

    } catch (err) {
        res.status(500).json({ message: "Transfer failed due to server error." });
    }
});

module.exports = router;
const router = require('express').Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

router.post('/', async (req, res) => {
    try {
        const { senderId, receiverUsername, amount, walletType } = req.body;

        // 1. Amount ko laazmi Number mein convert karein
        const transferAmount = Number(amount);
        if (!transferAmount || transferAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount!" });
        }

        const fee = transferAmount * 0.03;
        const totalDeduction = transferAmount + fee;

        // 2. Sender aur Receiver ko database mein dhoondna
        const sender = await User.findById(senderId);
        if (!sender) return res.status(404).json({ message: "Sender not found!" });

        const receiver = await User.findOne({ username: receiverUsername.toLowerCase().trim() });
        if (!receiver) return res.status(404).json({ message: "Receiver not found!" });

        if (sender.username === receiver.username) {
            return res.status(400).json({ message: "You cannot send money to yourself!" });
        }

        // 3. Balance Check
        if (sender.wallets[walletType] < totalDeduction) {
            return res.status(400).json({ message: "Insufficient Balance!" });
        }

        // 4. Balances Update Karna
        sender.wallets[walletType] -= totalDeduction;
        receiver.wallets.deposit += transferAmount; // Receiver ko hamesha play balance mein milega

        await sender.save();
        await receiver.save();

        // 5. 📝 SENDER ki History Record Karna
        await Transaction.create({
            userId: sender._id,
            type: 'transfer',
            amount: totalDeduction, 
            netAmount: totalDeduction,
            details: `💸 Sent $${transferAmount.toFixed(2)} to ${receiver.username} (Fee: $${fee.toFixed(2)})`,
            status: 'completed'
        });

        // 6. 📝 RECEIVER ki History Record Karna
        await Transaction.create({
            userId: receiver._id,
            type: 'deposit',
            amount: transferAmount,
            netAmount: transferAmount,
            details: `📥 Received $${transferAmount.toFixed(2)} from ${sender.username}`,
            status: 'completed'
        });

        // 7. 👑 ADMIN ko 3% Fee bhejna (Optional but recommended)
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
        console.error("Transfer Error:", err);
        res.status(500).json({ message: "Transfer failed due to server error." });
    }
});

module.exports = router;
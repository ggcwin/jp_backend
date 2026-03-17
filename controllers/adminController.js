const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction'); 
const DrawSettings = require('../models/DrawSettings'); // ✨ NAYA: Draw Settings Model

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.updateUserBalance = async (req, res) => {
    try {
        const { userId, amount, walletType } = req.body; 
        const numAmount = Number(amount);

        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount!" });
        }

        const adminAccount = await User.findOne({ role: 'admin' });
        if (!adminAccount) return res.status(404).json({ message: "Admin account not found in database!" });

        if (adminAccount.wallets.deposit < numAmount) {
            return res.status(400).json({ message: `Admin Treasury only has Rs. ${adminAccount.wallets.deposit.toFixed(2)} left!` });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        adminAccount.wallets.deposit -= numAmount;
        if (!user.wallets) user.wallets = { deposit: 0, win: 0, reward: 0 };
        if (walletType === 'win') {
            user.wallets.win += numAmount;
        } else {
            user.wallets.deposit += numAmount;
        }

        await adminAccount.save();
        await user.save();

        const historyRecord = new Transaction({
            userId: user._id, type: walletType === 'win' ? 'win' : 'deposit', amount: numAmount,
            details: `Transferred from Admin Treasury to ${walletType.toUpperCase()} wallet`, status: 'completed'
        });
        await historyRecord.save();

        res.status(200).json({ 
            message: `Successfully transferred Rs. ${numAmount} to ${user.username}. Admin Balance Left: Rs. ${adminAccount.wallets.deposit.toFixed(2)}`,
            wallets: user.wallets 
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const allUsers = await User.find();
        let totalDepositsInSystem = 0;
        let totalWinsInSystem = 0;

        allUsers.forEach(u => {
            totalDepositsInSystem += (u.wallets?.deposit || 0);
            totalWinsInSystem += (u.wallets?.win || 0);
        });

        res.status(200).json({ totalUsers, totalDepositsInSystem, totalWinsInSystem });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getLockedUsers = async (req, res) => {
    try {
        const lockedUsers = await User.find({ isLocked: true }).select('username email failedLoginAttempts');
        res.status(200).json({ success: true, users: lockedUsers });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; 
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.isLocked = false;
        user.failedLoginAttempts = 0;
        await user.save();

        res.status(200).json({ success: true, message: `Account ${user.username} has been UNBLOCKED!` });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

// =======================================================
// 🎰 NAYE VIP ADMIN FEATURES (DRAW CONTROL)
// =======================================================

exports.getDrawSettings = async (req, res) => {
    try {
        let settings = await DrawSettings.findOne();
        if (!settings) {
            settings = await DrawSettings.create({}); // Agar database mein nahi hai toh bana do
        }
        res.status(200).json({ success: true, settings });
    } catch (error) { 
        res.status(500).json({ success: false, message: 'Server error', error: error.message }); 
    }
};

exports.updateDrawSettings = async (req, res) => {
    try {
        const { nextWinningNumber, isRigged } = req.body; 
        let settings = await DrawSettings.findOne();
        
        if (!settings) {
            settings = new DrawSettings();
        }

        // 4-Digit Number Validation
        if (nextWinningNumber && nextWinningNumber.length === 4) {
            settings.nextWinners = [nextWinningNumber, '0000', '0000'];
        }
        
        if (typeof isRigged === 'boolean') {
            settings.isRigged = isRigged;
        }

        await settings.save();
        res.status(200).json({ 
            success: true, 
            message: "Draw settings updated successfully! 🔥", 
            settings 
        });
    } catch (error) { 
        res.status(500).json({ success: false, message: 'Server error', error: error.message }); 
    }
};
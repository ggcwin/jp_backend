const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction'); 
const DrawSettings = require('../models/DrawSettings'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, users });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
};

exports.updateUserBalance = async (req, res) => {
    try {
        const { userId, amount, walletType } = req.body; 
        const numAmount = Number(amount);

        if (!numAmount || numAmount <= 0) return res.status(400).json({ message: "Invalid amount!" });

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

exports.getDrawSettings = async (req, res) => {
    try {
        let settings = await DrawSettings.findOne();
        if (!settings) settings = await DrawSettings.create({}); 
        res.status(200).json({ success: true, settings });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.updateDrawSettings = async (req, res) => {
    try {
        const { nextWinningNumber, isRigged } = req.body; 
        let settings = await DrawSettings.findOne();
        if (!settings) settings = new DrawSettings();

        if (nextWinningNumber && nextWinningNumber.length === 4) {
            settings.nextWinners = [nextWinningNumber, '0000', '0000'];
        }
        if (typeof isRigged === 'boolean') settings.isRigged = isRigged;

        await settings.save();
        res.status(200).json({ success: true, message: "Draw settings updated successfully! 🔥", settings });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.getTicketStats = async (req, res) => {
    try {
        const pendingTickets = await Ticket.find({ status: 'pending' });
        let numberCounts = {};

        pendingTickets.forEach(t => {
            const num = t.chosenNumbers[0];
            if (num && num.length === 4) {
                numberCounts[num] = (numberCounts[num] || 0) + 1;
            }
        });

        let soldStats = [];
        for (let num in numberCounts) {
            soldStats.push({ number: num, count: numberCounts[num] });
        }
        soldStats.sort((a, b) => b.count - a.count);

        res.status(200).json({ success: true, stats: soldStats });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.changeUserPassword = async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ success: true, message: `Password for ${user.username} changed successfully!` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.adjustUserBalance = async (req, res) => {
    try {
        const { userId, walletType, amount, action } = req.body; 
        const numAmount = Number(amount);
        
        if (!numAmount || numAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.wallets) user.wallets = { deposit: 0, win: 0, reward: 0, bonus: 0 };
        if (user.wallets[walletType] === undefined) user.wallets[walletType] = 0;

        if (action === 'deduct') {
            if (user.wallets[walletType] < numAmount) {
                return res.status(400).json({ success: false, message: `User only has Rs. ${user.wallets[walletType]} in ${walletType} wallet!` });
            }
            user.wallets[walletType] -= numAmount;
        } else {
            user.wallets[walletType] += numAmount;
        }

        await user.save();

        await Transaction.create({
            userId: user._id,
            type: action === 'add' ? 'deposit' : 'withdraw',
            amount: numAmount,
            netAmount: action === 'add' ? numAmount : -numAmount,
            details: `Admin ${action === 'add' ? 'Added' : 'Deducted'} Rs. ${numAmount} ${action === 'add' ? 'to' : 'from'} ${walletType.toUpperCase()} wallet`,
            status: 'completed'
        });

        res.status(200).json({ success: true, message: `Successfully ${action === 'add' ? 'added' : 'deducted'} Rs. ${numAmount}.`, wallets: user.wallets });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.loginAsUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            success: true, 
            token, 
            user: { id: user._id, username: user.username, role: user.role } 
        });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ✨ NAYA LOGIC: Global Ledger for Admin (With Usernames)
exports.getGlobalLedger = async (req, res) => {
    try {
        const history = await Transaction.find()
            .populate('userId', 'username') // Yeh user ka naam layega
            .sort({ createdAt: -1 })
            .limit(200); // Last 200 record dikhayega taake server heavy na ho
            
        res.status(200).json({ success: true, history });
    } catch (error) { 
        res.status(500).json({ success: false, message: 'Server error', error: error.message }); 
    }
};
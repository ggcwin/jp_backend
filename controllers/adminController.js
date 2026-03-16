const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction'); // 🌟 Naya Import History ke liye

// 1. Saare Users Ka Data Dekhna
exports.getAllUsers = async (req, res) => {
    try {
        // Password ke ilawa saara data le aao, naye users pehle dikhao
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// 2. User Ka Balance Update/Approve Karna (Admin Ke Khazane Se Deduction Ke Sath)
exports.updateUserBalance = async (req, res) => {
    try {
        const { userId, amount, walletType } = req.body; 
        const numAmount = Number(amount);

        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount!" });
        }

        // 👑 1. ADMIN KO DHOONDO AUR KHAZANA CHECK KARO
        const adminAccount = await User.findOne({ role: 'admin' });
        if (!adminAccount) return res.status(404).json({ message: "Admin account not found in database!" });

        if (adminAccount.wallets.deposit < numAmount) {
            return res.status(400).json({ message: `Boss, your Admin Wallet doesn't have enough funds! Current balance: $${adminAccount.wallets.deposit}` });
        }

        // 👤 2. USER KO DHOONDO
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        const validWallets = ['deposit', 'win', 'reward'];
        if (!validWallets.includes(walletType)) {
            return res.status(400).json({ message: "Invalid wallet type!" });
        }

        // 💸 3. ASAL MAGIC: Admin se KATO (-) aur User mein DAALO (+)
        adminAccount.wallets.deposit -= numAmount; // Admin ka balance minus

        if (walletType === 'deposit') user.wallets.deposit += numAmount;
        else if (walletType === 'win') user.wallets.win += numAmount;
        else if (walletType === 'reward') user.wallets.reward += numAmount;

        // Dono accounts save kar lo
        await adminAccount.save();
        await user.save();

        // 🌟 4. HISTORY RECORD SAVE KARNA
        const historyRecord = new Transaction({
            userId: user._id,
            type: walletType === 'win' ? 'win' : 'deposit', 
            amount: numAmount,
            details: `Transferred from Admin Treasury to ${walletType.toUpperCase()} wallet`,
            status: 'completed'
        });
        await historyRecord.save();

        res.status(200).json({ 
            message: `Successfully transferred $${numAmount} to ${user.username}. Admin Balance Left: $${adminAccount.wallets.deposit.toFixed(2)}`,
            wallets: user.wallets 
        });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// 3. System Stats Dekhna (Total Deposits, Total Users, etc.)
exports.getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        
        // Sab users ke wallets ka hisab lagana
        const allUsers = await User.find();
        let totalDepositsInSystem = 0;
        let totalWinsInSystem = 0;

        allUsers.forEach(u => {
            totalDepositsInSystem += (u.wallets?.deposit || 0);
            totalWinsInSystem += (u.wallets?.win || 0);
        });

        res.status(200).json({
            totalUsers,
            totalDepositsInSystem,
            totalWinsInSystem
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const router = require('express').Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/User'); 
const Voucher = require('../models/Voucher');

// --- 📝 1. REGISTER ROUTE (First User = Admin Logic) ---
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, dob, sponsorUsername } = req.body;

        const userCount = await User.countDocuments();
        let sponsor = null;
        let assignedRole = 'user';

        if (userCount === 0) {
            assignedRole = 'admin';
        } else {
            if (!sponsorUsername) return res.status(400).json({ message: "Sponsor is strictly required to register!" });

            sponsor = await User.findOne({ username: sponsorUsername.toLowerCase() });
            if (!sponsor) return res.status(404).json({ message: "Invalid Sponsor! Please enter a correct sponsor username." });

            if (sponsor.username === 'admin' || sponsor.role === 'admin') {
                const adminReferralsCount = await User.countDocuments({ referredBy: sponsor._id });
                if (adminReferralsCount >= 1) {
                    return res.status(403).json({ message: "Admin has already sponsored their 1 allowed member! Please use another sponsor." });
                }
            }
        }

        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: "Username already taken!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username: username.toLowerCase(),
            email: email,
            password: hashedPassword,
            dob: dob,
            referredBy: sponsor ? sponsor._id : null,
            role: assignedRole
        });

        await newUser.save();

        res.status(201).json({ 
            success: true,
            message: assignedRole === 'admin' ? "First account created! You are now the Admin." : "Registration successful! Welcome to the Jackpot Family." 
        });

    } catch (err) { 
        res.status(500).json({ success: false, message: err.message }); 
    }
});

// --- 🔐 2. LOGIN ROUTE ---
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials!" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' }
        );

        res.status(200).json({ 
            token, 
            user: { id: user._id, username: user.username, role: user.role, wallets: user.wallets } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 🛡️ MIDDLEWARE FOR AUTH ---
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Invalid Token!' });
    }
};

// --- 👤 3. GET USER PROFILE & WALLETS ---
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found!" });
        
        res.status(200).json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 💰 4. DEPOSIT API (Simulated Top-up) ---
router.post('/deposit', auth, async (req, res) => {
    try {
        const { amount, method } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount!" });

        const user = await User.findById(req.user.id);
        user.wallets.deposit += Number(amount);
        await user.save();

        res.status(200).json({ success: true, message: `Successfully deposited $${amount} via ${method}! 💸`, wallets: user.wallets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 💸 5. WITHDRAW API (With 10% Fee) ---
router.post('/withdraw', auth, async (req, res) => {
    try {
        const { amount, method, walletType, details } = req.body;
        if (!amount || amount < 5) return res.status(400).json({ message: "Minimum withdrawal amount is $5!" });

        const user = await User.findById(req.user.id);
        const validWallets = ['deposit', 'win', 'bonus'];
        if (!validWallets.includes(walletType)) return res.status(400).json({ message: "Invalid wallet selected!" });

        if (user.wallets[walletType] < amount) {
            return res.status(400).json({ message: `Insufficient funds in ${walletType.toUpperCase()} Wallet!` });
        }

        // ✨ 10% Fee Calculation
        const fee = amount * 0.10;
        const payableAmount = amount - fee;

        user.wallets[walletType] -= Number(amount);
        await user.save();

        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: user._id, type: 'withdraw', amount: amount, netAmount: payableAmount,
            details: `Withdraw via ${method} to: ${details} (Fee: $${fee.toFixed(2)}, Payable: $${payableAmount.toFixed(2)})`, status: 'pending'
        });

        res.status(200).json({ success: true, message: `Withdrawal of $${amount} requested. 10% fee applied. You will receive $${payableAmount.toFixed(2)}. 💸`, wallets: user.wallets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 🎟️ 6. CREATE VOUCHER API (With 3% Fee) ---
router.post('/create-voucher', auth, async (req, res) => {
    try {
        const { amount, walletType } = req.body;
        if (!amount || amount < 1) return res.status(400).json({ message: "Minimum voucher amount is $1!" });

        const user = await User.findById(req.user.id);
        const validWallets = ['deposit', 'win', 'bonus'];
        if (!validWallets.includes(walletType)) return res.status(400).json({ message: "Invalid wallet!" });

        // ✨ 3% Fee Calculation
        const fee = amount * 0.03;
        const totalCost = amount + fee;

        if (user.wallets[walletType] < totalCost) {
            return res.status(400).json({ message: `Insufficient funds! You need $${totalCost.toFixed(2)} including 3% fee.` });
        }

        user.wallets[walletType] -= totalCost;
        await user.save();

        // Generate 16-digit voucher code
        const code = Math.random().toString().slice(2, 18).padEnd(16, '0');

        await Voucher.create({ code, amount, creatorId: user._id });

        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: user._id, type: 'voucher_create', amount: totalCost, netAmount: -totalCost,
            details: `Created $${amount} voucher (Fee: $${fee.toFixed(2)}) from ${walletType}`, status: 'completed'
        });

        res.status(200).json({ success: true, message: "Voucher created successfully!", code, wallets: user.wallets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 🎁 7. REDEEM VOUCHER API ---
router.post('/redeem-voucher', auth, async (req, res) => {
    try {
        const { code } = req.body;
        const voucher = await Voucher.findOne({ code, status: 'active' });
        if (!voucher) return res.status(400).json({ message: "Invalid or already redeemed voucher!" });

        const user = await User.findById(req.user.id);
        
        // Add funds to Play Balance
        user.wallets.deposit += voucher.amount;
        await user.save();

        voucher.status = 'redeemed';
        voucher.redeemedBy = user._id;
        voucher.redeemedAt = new Date();
        await voucher.save();

        res.status(200).json({ success: true, message: `Successfully redeemed $${voucher.amount}!`, wallets: user.wallets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
const router = require('express').Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/User'); 
const Voucher = require('../models/Voucher');

// --- 📝 1. REGISTER ROUTE (Numeric Username & Sponsor Fix) ---
router.post('/register', async (req, res) => {
    try {
        let { username, email, password, dob, sponsorUsername } = req.body;

        // Clean & Format Data
        username = username.toString().toLowerCase().trim();
        email = email.toLowerCase().trim();
        if (sponsorUsername) sponsorUsername = sponsorUsername.toString().toLowerCase().trim();

        const userCount = await User.countDocuments();
        let sponsor = null;
        let assignedRole = 'user';

        // Pehla banda Admin banega
        if (userCount === 0) {
            assignedRole = 'admin';
        } else {
            // Baqi sab ke liye sponsor laazmi hai
            if (!sponsorUsername) {
                return res.status(400).json({ success: false, message: "Sponsor is strictly required to register!" });
            }

            sponsor = await User.findOne({ username: sponsorUsername });
            if (!sponsor) {
                return res.status(404).json({ success: false, message: "Invalid Sponsor! Please enter a correct sponsor username." });
            }

            // Admin sirf 1 referral link kar sakta hai
            if (sponsor.role === 'admin') {
                const adminReferralsCount = await User.countDocuments({ referredBy: sponsor._id });
                if (adminReferralsCount >= 1) {
                    return res.status(403).json({ success: false, message: "Admin has already sponsored their 1 allowed member!" });
                }
            }
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ success: false, message: "Username already taken!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            dob,
            referredBy: sponsor ? sponsor._id : null,
            role: assignedRole,
            wallets: { deposit: 0, win: 0, bonus: 0 }
        });

        await newUser.save();

        res.status(201).json({ 
            success: true,
            message: assignedRole === 'admin' ? "First account created! Admin setup complete." : "Registration successful!" 
        });

    } catch (err) { 
        res.status(500).json({ success: false, message: err.message }); 
    }
});

// --- 🔐 2. LOGIN ROUTE ---
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUsername = username.toString().toLowerCase().trim();

        const user = await User.findOne({ username: cleanUsername });
        if (!user) return res.status(404).json({ success: false, message: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials!" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' }
        );

        res.status(200).json({ 
            success: true,
            token, 
            user: { id: user._id, username: user.username, role: user.role, wallets: user.wallets } 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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

// --- 👤 3. GET USER PROFILE ---
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found!" });
        res.status(200).json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 🔄 4. PASSWORD RESET API ---
router.post('/reset-password-dob', async (req, res) => {
    try {
        const { email, dob, newPassword } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim(), dob });

        if (!user) return res.status(404).json({ success: false, message: "Invalid Email or DOB!" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ success: true, message: "Password reset successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
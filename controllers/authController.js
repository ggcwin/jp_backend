const User = require('../models/User');
const Transaction = require('../models/Transaction'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. REGISTER (DOB Included)
exports.register = async (req, res) => {
    try {
        const { username, email, password, fullName, dob, referrer } = req.body;

        if (!dob) return res.status(400).json({ message: 'Date of Birth is required!' });

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ message: 'Username or Email already exists!' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username, fullName, email, dob, password: hashedPassword, // ✨ DOB yahan save ho rahi hai
            wallets: { deposit: 0, reward: 0, win: 0 } // Fresh account balance
        });

        await newUser.save();
        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. LOGIN (Same as before)
exports.login = async (req, res) => {
    try {
        const { username, email, password } = req.body; 
        const loginId = email || username;

        const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
        if (!user) return res.status(404).json({ message: 'User not found!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials!' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ token, user: { _id: user._id, username: user.username, email: user.email, wallets: user.wallets } });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 🚀 3. DIRECT PASSWORD RESET (Using DOB & Email)
exports.resetPasswordWithDob = async (req, res) => {
    try {
        const { email, dob, newPassword } = req.body;

        // User dhoondo jiska Email aur DOB dono match karein
        const user = await User.findOne({ email, dob });
        if (!user) {
            return res.status(400).json({ message: "Verification failed! Email or Date of Birth is incorrect." });
        }

        // Naya password encrypt aur save karein
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ message: "Password reset successfully! You can now login." });
    } catch (error) {
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        res.json(user);
    } catch (error) { res.status(500).json({ error: error.message }); }
};
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Withdraw = require('../models/Withdraw');
const Promotion = require('../models/Promotion');

// ✨ Admin Controller import kiya jismein unblock ka logic hai
const adminController = require('../controllers/adminController');

// --- EXISTING PROMOTION UPLOAD LOGIC ---
const storage = multer.diskStorage({
    destination: './uploads/promotions/',
    filename: (req, file, cb) => cb(null, 'promo-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- EXISTING ROUTES (Stats & Promotion) ---
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const allTickets = await Ticket.find();
        const totalSales = allTickets.reduce((acc, t) => acc + (t.price || 0), 0);
        const pendingWithdraws = await Withdraw.countDocuments({ status: 'Pending' });
        const totalWinners = await Ticket.countDocuments({ status: 'won' });

        res.status(200).json({ totalUsers, totalSales: totalSales.toFixed(2), pendingWithdraws, totalWinners });
    } catch (err) { res.status(500).json({ message: "Stats Error" }); }
});

router.post('/promotion/upload', upload.single('promoImage'), async (req, res) => {
    try {
        const imageUrl = `/uploads/promotions/${req.file.filename}`;
        await Promotion.deleteMany({});
        await new Promotion({ imageUrl }).save();
        res.status(200).json({ message: "Promotion updated!", imageUrl });
    } catch (err) { res.status(500).json({ message: "Upload failed" }); }
});

router.post('/user/toggle-block', async (req, res) => {
    try {
        const user = await User.findById(req.body.userId);
        user.status = user.status === 'blocked' ? 'active' : 'blocked';
        await user.save();
        res.status(200).json({ message: `User is now ${user.status}` });
    } catch (err) { res.status(500).json({ message: "Action failed" }); }
});

// =======================================================
// ✨ NAYE VIP ADMIN ROUTES (Locked Accounts System)
// =======================================================

// 🔒 Saare 3-attempt locked accounts laane ke liye
router.get('/locked-users', adminController.getLockedUsers);

// 🔓 Kisi ek account ko unblock karne ke liye
router.post('/unblock', adminController.unblockUser);

module.exports = router;
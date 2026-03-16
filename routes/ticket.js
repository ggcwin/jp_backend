const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');

// 🛡️ Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ success: false, message: 'Access Denied! No token provided.' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid Token!' });
    }
};

// Unique Code Generator Helper
const generateReceiptCode = () => {
    return 'RC-' + Math.random().toString(36).substr(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);
};

// 🎫 POST: Buy Ticket API
router.post('/buy', auth, async (req, res) => {
    try {
        // ✨ NAYA LOGIC: req.body mein ab 'walletType' bhi aayega
        const { gameType, quantity, lines, walletType } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found!" });

        // ✨ WALLET SELECTION LOGIC
        const validWallets = ['deposit', 'win', 'bonus'];
        const selectedWallet = validWallets.includes(walletType) ? walletType : 'deposit';

        let totalPrice = 0;
        let winProjection = 0;
        const ticketsToSave = [];

        // ✨ LOOP OVER EVERY LINE (Har number line ki alag calculation hogi)
        for (let line of lines) {
            let lineMultiplier = 1;
            let lineWin = 0;

            if (gameType === '4tune') {
                let count = 0;
                if (line.isStraight) { count++; lineWin += 360; }
                if (line.isMixFix) { count++; lineWin += 20; }
                if (count > 0) lineMultiplier = count;
            } else if (gameType === '3luck') {
                lineWin = 50;
            } else if (gameType === '2win') {
                lineWin = 10;
            } else if (gameType === '1won') {
                lineWin = 2;
            }

            totalPrice += (0.035 * lineMultiplier * quantity);
            winProjection += (lineWin * quantity);

            for (let i = 0; i < quantity; i++) {
                ticketsToSave.push({
                    userId: user._id,
                    chosenNumbers: line.chosenNumbers, 
                    positions: line.positions,
                    gameType: gameType,
                    isStraight: line.isStraight || false,
                    isMixFix: line.isMixFix || false,
                    price: 0.035 * lineMultiplier, 
                    receiptCode: generateReceiptCode()
                });
            }
        }

        // ✨ SELECTED WALLET MEIN BALANCE CHECK
        if (user.wallets[selectedWallet] < totalPrice) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient balance in ${selectedWallet.toUpperCase()} Wallet! Please deposit funds.` 
            });
        }

        // ✨ SELECTED WALLET SE PAISE KATO
        user.wallets[selectedWallet] -= totalPrice;
        await user.save();
        await Ticket.insertMany(ticketsToSave);

        // SAFE GUARD 1: Transaction Creation
        try {
            await Transaction.create({
                userId: user._id, type: 'ticket_buy', amount: totalPrice, netAmount: -totalPrice,
                details: `Bought ${quantity}x ${gameType} [${lines.length} Lines] via ${selectedWallet} wallet`, status: 'completed'
            });
        } catch (txError) {
            console.log("Transaction Note (Ignored):", txError.message);
        }

        // SAFE GUARD 2: Sponsor Fetching
        let sponsorName = "No Sponsor";
        let grandSponsorName = "No G.Sponsor";
        
        try {
            if (user.referredBy && user.referredBy.toString().length === 24) {
                const s = await User.findById(user.referredBy);
                if (s) {
                    sponsorName = s.username;
                    if (s.referredBy && s.referredBy.toString().length === 24) {
                        const gs = await User.findById(s.referredBy);
                        if (gs) grandSponsorName = gs.username;
                    }
                }
            }
        } catch (spError) {
            console.log("Sponsor Note (Ignored):", spError.message);
        }

        // Send Success Response
        res.status(200).json({
            success: true,
            message: "Tickets purchased successfully! 🎰",
            receiptData: {
                username: user.username,
                email: user.email || "user@jackpot.com",
                amountPaid: totalPrice,
                winAmount: winProjection,
                sponsorUsername: sponsorName,
                grandSponsorUsername: grandSponsorName
            }
        });

    } catch (err) {
        console.error("Ticket Buy Error:", err);
        res.status(500).json({ success: false, message: "Server Error: Could not process ticket." });
    }
});
// 🎫 GET: Fetch User's Tickets
router.get('/my-tickets', auth, async (req, res) => {
    try {
        // User ke tamam tickets dhoondein aur naye pehle dikhayen (sort -1)
        const tickets = await Ticket.find({ userId: req.user.id }).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            tickets: tickets
        });
    } catch (err) {
        console.error("Fetch Tickets Error:", err);
        res.status(500).json({ success: false, message: "Could not fetch tickets." });
    }
});
module.exports = router;
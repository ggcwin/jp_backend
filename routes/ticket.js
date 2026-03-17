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

const generateReceiptCode = () => {
    return 'RC-' + Math.random().toString(36).substr(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);
};

// 🎫 POST: Buy Ticket API
router.post('/buy', auth, async (req, res) => {
    try {
        const { gameType, quantity, lines, walletType } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found!" });

        const validWallets = ['deposit', 'win', 'bonus'];
        const selectedWallet = validWallets.includes(walletType) ? walletType : 'deposit';

        let totalPrice = 0;
        let winProjection = 0;
        const ticketsToSave = [];

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

            totalPrice += (5 * lineMultiplier * quantity);
            winProjection += (lineWin * quantity);

            for (let i = 0; i < quantity; i++) {
                ticketsToSave.push({
                    userId: user._id,
                    chosenNumbers: line.chosenNumbers, 
                    positions: line.positions,
                    gameType: gameType,
                    isStraight: line.isStraight || false,
                    isMixFix: line.isMixFix || false,
                    price: 5 * lineMultiplier,
                    receiptCode: generateReceiptCode()
                });
            }
        }

        if (user.wallets[selectedWallet] < totalPrice) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient balance in ${selectedWallet.toUpperCase()} Wallet! Please deposit funds.` 
            });
        }

        user.wallets[selectedWallet] -= totalPrice;
        await user.save();
        await Ticket.insertMany(ticketsToSave);

        try {
            await Transaction.create({
                userId: user._id, type: 'ticket_buy', amount: totalPrice, netAmount: -totalPrice,
                // ✨ FIX: History detail mein Rs.
                details: `Bought ${quantity}x ${gameType} [${lines.length} Lines] for Rs. ${totalPrice} via ${selectedWallet} wallet`, status: 'completed'
            });
        } catch (txError) {
            console.log("Transaction Note (Ignored):", txError.message);
        }

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

router.get('/my-tickets', auth, async (req, res) => {
    try {
        const tickets = await Ticket.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, tickets: tickets });
    } catch (err) {
        console.error("Fetch Tickets Error:", err);
        res.status(500).json({ success: false, message: "Could not fetch tickets." });
    }
});

module.exports = router;
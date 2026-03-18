const Voucher = require('../models/Voucher');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// 🎫 Helper: Generate Random Code (e.g. GGC-A1B2C3D4)
const generateVoucherCode = () => {
    return 'GGC-' + Math.random().toString(36).substr(2, 8).toUpperCase();
};

// 🎟️ 1. CREATE VOUCHER (Admin = Free, User = Paid + 3% Fee)
exports.createVoucher = async (req, res) => {
    try {
        const { amount, walletType } = req.body;
        const numAmount = Number(amount);

        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount!" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found!" });

        // 🛑 USER LOGIC: Balance Check, 3% Fee & Deduction
        if (user.role !== 'admin') {
            const validWallets = ['deposit', 'win'];
            const selectedWallet = validWallets.includes(walletType) ? walletType : 'deposit';

            // ✨ NAYA LOGIC: 3% Fee Calculation
            const feeAmount = numAmount * 0.03;
            const totalCost = numAmount + feeAmount; // e.g., 5 + 0.15 = 5.15

            if (user.wallets[selectedWallet] < totalCost) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient balance! You need Rs. ${totalCost.toFixed(2)} (including 3% fee) in your ${selectedWallet.toUpperCase()} Wallet.` 
                });
            }

            // User se total paise (Amount + Fee) kato
            user.wallets[selectedWallet] -= totalCost;
            await user.save();

            // 💰 SYSTEM PROFIT: 3% fee ko Admin ke account mein bhej do
            const adminAccount = await User.findOne({ role: 'admin' });
            if (adminAccount) {
                adminAccount.wallets.deposit += feeAmount;
                await adminAccount.save();
            }

            // Transaction History mein save karo (Total cost dikhaye)
            await Transaction.create({
                userId: user._id, 
                type: 'withdraw', 
                amount: totalCost, 
                netAmount: -totalCost,
                details: `Generated Rs. ${numAmount} Voucher (Included Rs. ${feeAmount.toFixed(2)} Fee)`, 
                status: 'completed'
            });
        }
        // ✨ ADMIN LOGIC: Agar role 'admin' hai toh upar wala block skip ho jayega (0 Fee, No balance cut)

        // 💾 Save Voucher in Database
        const newVoucher = await Voucher.create({
            code: generateVoucherCode(),
            amount: numAmount, // Voucher asli amount ka hi banega (e.g. 5 Rs)
            createdBy: user._id,
            creatorRole: user.role,
            status: 'active'
        });

        res.status(200).json({ 
            success: true, 
            message: "Voucher generated successfully!", 
            voucher: newVoucher 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 🎟️ 2. ADMIN: GET ALL VOUCHERS (Master Record)
exports.getAdminVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find()
            .populate('createdBy', 'username role') 
            .populate('redeemedBy', 'username')     
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, vouchers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 🎟️ 3. USER: REDEEM VOUCHER
exports.redeemVoucher = async (req, res) => {
    try {
        const { code } = req.body;
        
        const voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });
        if (!voucher) return res.status(404).json({ success: false, message: "Invalid Voucher Code!" });

        if (voucher.status === 'redeemed') {
            return res.status(400).json({ success: false, message: "This voucher is already redeemed!" });
        }

        const user = await User.findById(req.user.id);

        // Update Voucher Status
        voucher.status = 'redeemed';
        voucher.redeemedBy = user._id;
        voucher.redeemedAt = new Date();
        await voucher.save();

        // User ke Play (Deposit) wallet mein original voucher amount daalo
        user.wallets.deposit += voucher.amount;
        await user.save();

        // Transaction Save karo
        await Transaction.create({
            userId: user._id, type: 'deposit', amount: voucher.amount, netAmount: voucher.amount,
            details: `Redeemed Voucher: ${voucher.code}`, status: 'completed'
        });

        res.status(200).json({ success: true, message: `Successfully redeemed Rs. ${voucher.amount}!`, amount: voucher.amount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
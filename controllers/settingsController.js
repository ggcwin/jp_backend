const Settings = require('../models/Settings');

// 1. GET SETTINGS (For both User & Admin)
exports.getFinancialSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({}); // Pehli dafa default create kar dega
        }
        res.status(200).json({ success: true, settings });
    } catch (error) { 
        res.status(500).json({ success: false, message: error.message }); 
    }
};

// 2. UPDATE SETTINGS (Only Admin)
exports.updateFinancialSettings = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access only!' });
        }

        const { usdtTrc20, usdtBep20, bankName, bankTitle, bankAccount } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        if (usdtTrc20) settings.usdtTrc20 = usdtTrc20;
        if (usdtBep20) settings.usdtBep20 = usdtBep20;
        if (bankName) settings.bankName = bankName;
        if (bankTitle) settings.bankTitle = bankTitle;
        if (bankAccount) settings.bankAccount = bankAccount;

        await settings.save();
        res.status(200).json({ success: true, message: 'Financial details updated successfully! ✅', settings });
    } catch (error) { 
        res.status(500).json({ success: false, message: error.message }); 
    }
};
const router = require('express').Router();
const Settings = require('../models/Settings');

// GET: Settings fetch karna
router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.status(200).json(settings);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// POST: Settings Update karna
router.post('/update', async (req, res) => {
    try {
        const { usdtTRC20, usdtBEP20, usdtERC20, usdtPolygon, paytmUpi, jazzcashNumber, telegramLink } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        if (usdtTRC20 !== undefined) settings.usdtTRC20 = usdtTRC20;
        if (usdtBEP20 !== undefined) settings.usdtBEP20 = usdtBEP20;
        if (usdtERC20 !== undefined) settings.usdtERC20 = usdtERC20;
        if (usdtPolygon !== undefined) settings.usdtPolygon = usdtPolygon;
        if (paytmUpi !== undefined) settings.paytmUpi = paytmUpi;
        if (jazzcashNumber !== undefined) settings.jazzcashNumber = jazzcashNumber;
        if (telegramLink !== undefined) settings.telegramLink = telegramLink;

        await settings.save();
        res.status(200).json({ message: "Payment details updated successfully!", settings });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

module.exports = router;
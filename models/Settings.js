const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    usdtTRC20: { type: String, default: "" },
    usdtBEP20: { type: String, default: "" },
    usdtERC20: { type: String, default: "" },
    usdtPolygon: { type: String, default: "" },
    paytmUpi: { type: String, default: "" },
    jazzcashNumber: { type: String, default: "" },
    telegramLink: { type: String, default: "https://t.me/GGCWIN" }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
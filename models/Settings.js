const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    usdtTrc20: { type: String, default: 'TXYZ...Update_Address_in_Admin_Panel' },
    usdtBep20: { type: String, default: '0x...Update_Address_in_Admin_Panel' },
    bankName: { type: String, default: 'Update Bank Name' },
    bankTitle: { type: String, default: 'Update Account Title' },
    bankAccount: { type: String, default: '000000000000' },
    telegramLink: { type: String, default: 'https://t.me/your_admin_username' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
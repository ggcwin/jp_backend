const mongoose = require('mongoose');

const drawSettingsSchema = new mongoose.Schema({
    nextWinners: { 
        type: [String], 
        // ✨ FIX: 3-digits ki jagah ab 4-digits ('0000') kar diya gaya hai
        default: ['0000', '0000', '0000'] // 1st, 2nd, 3rd Prize
    },
    isRigged: { 
        type: Boolean, 
        default: false // Agar true hoga toh slot machine ye numbers uthayegi
    }
});

module.exports = mongoose.model('DrawSettings', drawSettingsSchema);
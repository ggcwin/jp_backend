const mongoose = require('mongoose');

const drawSettingsSchema = new mongoose.Schema({
    nextWinners: { 
        type: [String], 
        default: ['000', '000', '000'] // 1st, 2nd, 3rd Prize
    },
    isRigged: { 
        type: Boolean, 
        default: false // Agar true hoga toh slot machine ye numbers uthayegi
    }
});

module.exports = mongoose.model('DrawSettings', drawSettingsSchema);
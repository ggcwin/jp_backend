const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Promotion', promotionSchema);
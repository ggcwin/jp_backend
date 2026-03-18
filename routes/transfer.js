const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const transferController = require('../controllers/transferController');

const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access Denied!' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Invalid Token!' }); }
};

// ✨ Point to our new Transfer Controller (7% Fee Logic)
router.post('/', auth, transferController.transferFunds);

module.exports = router;
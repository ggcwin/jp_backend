require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https'); 
const cron = require('node-cron');

// --- 📦 Database Models ---
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Transaction = require('./models/Transaction');
const DrawSettings = require('./models/DrawSettings'); 
const Draw = require('./models/Draw'); 

// ✨ IMPORT ADMIN CONTROLLER (Jo humara main 4-digit draw logic chalayega)
const adminController = require('./controllers/adminController');

const app = express();

// --- 1. 🛡️ Middleware ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// --- 🚫 2. STRICT TICKETING BLOCKER (22:57 se 23:00 tak block) ---
app.use('/api/ticket/buy', (req, res, next) => {
    const pktTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
    const hours = pktTime.getHours();
    const minutes = pktTime.getMinutes();

    // Raat 10:57 PM se 10:59 PM tak purchasing block!
    if (hours === 22 && minutes >= 57) {
        return res.status(403).json({ message: "⏳ Draw in progress! Ticket purchasing is disabled until 11:00 PM." });
    }
    next();
});

// --- 3. 🛣️ Routes Registration ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/voucher', require('./routes/voucher'));
app.use('/api/vouchers', require('./routes/voucher')); 
app.use('/api/ticket', require('./routes/ticket'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/withdraw', require('./routes/withdraw'));
app.use('/api/wallet', require('./routes/wallet')); 
app.use('/api/transaction', require('./routes/transaction'));
app.use('/api/transfer', require('./routes/transfer'));
app.use('/api/admin', require('./routes/admin')); 
app.use('/network', require('./routes/network'));

// --- 📊 4. DRAW HISTORY & SYNC API ---
app.get('/api/draw/result-by-date', async (req, res) => {
    try {
        const { date } = req.query; // Expecting YYYY-MM-DD
        if (!date) return res.status(400).json({ message: "Date is required!" });

        const result = await Draw.findOne({ drawDate: date });
        if (!result) return res.status(404).json({ message: "No draw results for this date." });

        // ✨ FIX: Purane 2nd/3rd numbers hata diye. Ab sirf 1 hi 4-digit Winning Number aayega.
        res.status(200).json({
            winningNumber: result.winningNumber,
            status: result.status
        });
    } catch (err) {
        console.error("Result fetch error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

app.get('/', (req, res) => {
    res.status(200).send('GGC WIN Backend is awake and running! 🚀');
});

app.get('/ping', (req, res) => {
    res.status(200).send('Pong! 🏓');
});

// --- 5. 💾 Database Connection ---
const mongoURI = process.env.MONGO_URI; 
if (!mongoURI) {
  console.error("❌ ERROR: MONGO_URI is missing in .env file!");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('Database Connected Successfully! ✅'))
  .catch(err => console.error('Database connection error: ❌', err));


// ==========================================
// 🎰 6. THE ULTIMATE DAILY DRAW CRON JOB (11:00 PM PKT)
// ==========================================
cron.schedule('0 23 * * *', async () => {
    console.log('🎰 Starting GGC WIN Daily Draw at 11:00 PM PKT...');
    
    try {
        // ✨ FIX: Apna banaya hua Master Draw Engine call kar liya
        await adminController.runSlotMachineDraw();
        console.log('✅ Daily Draw execution finished.');
    } catch (error) {
        console.error('🚨 Slot Draw Critical Error:', error);
    }
}, {
    timezone: "Asia/Karachi"
});


// --- 7. ⚠️ Global Error Handler ---
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ 
    message: "Internal Server Error!", 
    error: process.env.NODE_ENV === 'development' ? err.message : {} 
  });
});

// --- 8. 🚀 Server Start ---
// ✨ FIX: Port update kar ke 3000 kar diya hai
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GGCWIN Backend is running on port ${PORT}`);
});

// --- 9. ⏰ SERVER WAKE-UP (ANTI-SLEEP PING) ---
setInterval(() => {
    https.get("https://ggcwin-backend.onrender.com", (res) => {
        console.log(`⏰ [WAKE-UP PING] Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('⏰ [WAKE-UP PING] Error:', err.message);
    });
}, 600000);
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
const Draw = require('./models/Draw'); // ✨ FIX: Aap ka apna Draw.js model connect kar diya

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

// --- 📊 4. DRAW HISTORY & SYNC API ---
app.get('/api/draw/result-by-date', async (req, res) => {
    try {
        const { date } = req.query; // Expecting YYYY-MM-DD
        if (!date) return res.status(400).json({ message: "Date is required!" });

        // ✨ FIX: Using your exact Draw schema
        const result = await Draw.findOne({ drawDate: date });
        if (!result) return res.status(404).json({ message: "No draw results for this date." });

        res.status(200).json({
            winningNumber: result.winningNumber,
            secondWinningNumber: result.secondWinningNumber,
            thirdWinningNumber: result.thirdWinningNumber
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
        const pktTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
        const todayStr = pktTime.toISOString().split('T')[0];

        let p1, p2, p3;

        // Step 1: Check Admin Locked Numbers
        const settings = await DrawSettings.findOne();

        if (settings && settings.isRigged && settings.nextWinners && settings.nextWinners.length === 3) {
            p1 = settings.nextWinners[0].toString().padStart(3, '0');
            p2 = settings.nextWinners[1].toString().padStart(3, '0');
            p3 = settings.nextWinners[2].toString().padStart(3, '0');
            console.log(`🔒 Admin Locked Numbers Used: 1st [${p1}], 2nd [${p2}], 3rd [${p3}]`);
            
            // Reset for next day
            settings.isRigged = false;
            await settings.save();
        } else {
            // Step 2: Random Fallback
            p1 = Array.from({length:3}, () => Math.floor(Math.random()*10)).join('');
            p2 = Array.from({length:3}, () => Math.floor(Math.random()*10)).join('');
            p3 = Array.from({length:3}, () => Math.floor(Math.random()*10)).join('');
            console.log(`🎲 Admin forgot! Server Generated Randoms: 1st [${p1}], 2nd [${p2}], 3rd [${p3}]`);
        }

        // Step 3: SAVE RESULT IN DATABASE (Using your Draw.js Model)
        await Draw.findOneAndUpdate(
            { drawDate: todayStr },
            { 
                winningNumber: p1, 
                secondWinningNumber: p2, 
                thirdWinningNumber: p3,
                raffleType: 'daily'
            },
            { new: true, upsert: true }
        );

        // Step 4: DISTRIBUTE REWARDS
        const pendingTickets = await Ticket.find({ status: 'pending' });
        let winnerCount = 0;

        for (let ticket of pendingTickets) {
            const guess = ticket.chosenNumbers[0];
            let rewardAmount = 0;
            let winPosition = null;

            if (guess === p1) { rewardAmount = 5000; winPosition = '1st'; } 
            else if (guess === p2) { rewardAmount = 2500; winPosition = '2nd'; } 
            else if (guess === p3) { rewardAmount = 1000; winPosition = '3rd'; }

            if (rewardAmount > 0) {
                await User.findByIdAndUpdate(ticket.userId, { 
                    $inc: { 'wallets.win': rewardAmount, totalEarning: rewardAmount } 
                });
                
                await Transaction.create({
                    userId: ticket.userId, type: 'win', amount: rewardAmount, netAmount: rewardAmount,
                    details: `Won ${winPosition} Prize in Daily Draw`, status: 'completed'
                });

                ticket.status = 'won';
                ticket.prizeAmount = rewardAmount;
                winnerCount++;
            } else {
                ticket.status = 'lost';
            }
            await ticket.save();
        }

        console.log(`✅ Draw Completed Successfully! Total Winners: ${winnerCount}`);

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
const PORT = process.env.PORT || 5000;
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
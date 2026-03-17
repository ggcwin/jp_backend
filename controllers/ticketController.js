const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); 
const Draw = require('../models/Draw'); 
const DrawSettings = require('../models/DrawSettings'); 

// 1. Commission Distribution (Referral System)
const distributeWinCommission = async (winnerId, winAmount) => {
    try {
        const commission = winAmount * 0.05; 
        const winner = await User.findById(winnerId);
        if (!winner || !winner.referredBy) return; 

        const sponsor = await User.findById(winner.referredBy);
        if (sponsor) {
            sponsor.wallets.win = (sponsor.wallets.win || 0) + commission;
            sponsor.referralEarnings = (sponsor.referralEarnings || 0) + commission;
            sponsor.totalEarning = (sponsor.totalEarning || 0) + commission;
            await sponsor.save();
            
            if (sponsor.referredBy) {
                const grandSponsor = await User.findById(sponsor.referredBy);
                if (grandSponsor) {
                    grandSponsor.wallets.win = (grandSponsor.wallets.win || 0) + commission;
                    grandSponsor.referralEarnings = (grandSponsor.referralEarnings || 0) + commission;
                    grandSponsor.totalEarning = (grandSponsor.totalEarning || 0) + commission;
                    await grandSponsor.save();
                }
            }
        }
    } catch (err) { console.error("Commission Error: ", err); }
};

// 🎫 2. Buy Ticket (Rs. 5 Fixed Price & 4-Digits)
exports.buyTickets = async (req, res) => {
    try {
        const { userId, ticketNumber, walletType } = req.body; 
        const cleanPrice = 5; // ✨ FIXED TICKET PRICE: Rs. 5

        if (!ticketNumber || ticketNumber.length !== 4) {
            return res.status(400).json({ message: "Invalid 4-digit number! Please enter exactly 4 digits." });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        if ((user.wallets[walletType || 'deposit'] || 0) < cleanPrice) {
            return res.status(400).json({ message: "Insufficient Balance in wallet!" });
        }

        user.wallets[walletType || 'deposit'] -= cleanPrice;
        await user.save();

        const receiptCode = 'JP-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        await new Ticket({
            userId: user._id,
            chosenNumbers: [ticketNumber],
            receiptCode,
            totalCost: cleanPrice,
            raffleDate: new Date().setHours(0,0,0,0)
        }).save();

        await Transaction.create({
            userId: user._id,
            type: 'purchase',
            amount: cleanPrice,
            netAmount: cleanPrice,
            details: `Bought Ticket #${ticketNumber} for Rs. ${cleanPrice} from ${walletType}`,
            status: 'completed'
        });

        res.status(201).json({ message: 'Success', receiptCode, newBalance: user.wallets[walletType || 'deposit'] });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// 3. Get Draw Result by Date
exports.getResultByDate = async (req, res) => {
    try {
        const { date } = req.query; 
        const result = await Draw.findOne({ drawDate: date });
        if (!result) return res.status(404).json({ message: "No result found" });
        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 🎰 4. Run Daily Draw 
exports.runDailyDraw = async (req, res) => {
    try {
        console.log("--- Jackpot 4-Digit Draw Execution Started ---");
        const todayStr = new Date().toISOString().split('T')[0];

        let settings = await DrawSettings.findOne();
        let finalWinningNumber;

        if (settings && settings.isRigged && settings.nextWinners && settings.nextWinners.length > 0) {
            finalWinningNumber = settings.nextWinners[0]; 
            settings.isRigged = false; 
            await settings.save();
        } else {
            finalWinningNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        }

        await Draw.findOneAndUpdate(
            { drawDate: todayStr },
            { winningNumber: finalWinningNumber },
            { upsert: true, new: true }
        );

        const todayStart = new Date().setHours(0,0,0,0);
        const tickets = await Ticket.find({ raffleDate: todayStart, status: 'pending' });
        
        // ✨ TOTAL SALES: Ticket Count * Rs. 5
        const totalSales = tickets.length * 5; 

        for (let t of tickets) {
            if (t.chosenNumbers[0] === finalWinningNumber) {
                t.status = 'won';
                const prize = totalSales * 0.40; // 40% of total sales goes to winner
                const winner = await User.findById(t.userId);
                if (winner) {
                    winner.wallets.win += prize;
                    winner.totalEarning += prize;
                    await winner.save();
                    await distributeWinCommission(winner._id, prize);
                }
            } else {
                t.status = 'lost';
            }
            await t.save();
        }

        console.log(`Draw Completed! Lucky Number: #${finalWinningNumber}`);
        if (res) res.status(200).json({ message: "Draw Success", winningNumber: finalWinningNumber });
    } catch (error) { 
        console.error("Draw Error:", error);
        if (res) res.status(500).json({ error: error.message }); 
    }
};

// 5. Get Recent Winners
exports.getRecentWinners = async (req, res) => {
    try {
        const recentWins = await Transaction.find({ type: 'win', status: 'completed' })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'username');
        
        const formatted = recentWins.map(w => ({
            username: w.userId ? w.userId.username : 'Unknown',
            prize: w.amount.toFixed(2)
        }));
        
        res.status(200).json(formatted);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};
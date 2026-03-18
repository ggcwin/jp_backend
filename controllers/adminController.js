const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction'); 
const DrawSettings = require('../models/DrawSettings'); 
const Draw = require('../models/Draw'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, users });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
};

exports.updateUserBalance = async (req, res) => {
    try {
        const { userId, amount, walletType } = req.body; 
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) return res.status(400).json({ message: "Invalid amount!" });

        const adminAccount = await User.findOne({ role: 'admin' });
        if (!adminAccount) return res.status(404).json({ message: "Admin account not found in database!" });

        if (adminAccount.wallets.deposit < numAmount) {
            return res.status(400).json({ message: `Admin Treasury only has Rs. ${adminAccount.wallets.deposit.toFixed(2)} left!` });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found!" });

        adminAccount.wallets.deposit -= numAmount;
        if (!user.wallets) user.wallets = { deposit: 0, win: 0, reward: 0 };
        if (walletType === 'win') {
            user.wallets.win += numAmount;
        } else {
            user.wallets.deposit += numAmount;
        }

        await adminAccount.save();
        await user.save();

        const historyRecord = new Transaction({
            userId: user._id, type: walletType === 'win' ? 'win' : 'deposit', amount: numAmount,
            details: `Transferred from Admin Treasury to ${walletType.toUpperCase()} wallet`, status: 'completed'
        });
        await historyRecord.save();

        res.status(200).json({ 
            message: `Successfully transferred Rs. ${numAmount} to ${user.username}. Admin Balance Left: Rs. ${adminAccount.wallets.deposit.toFixed(2)}`,
            wallets: user.wallets 
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const allUsers = await User.find();
        let totalDepositsInSystem = 0;
        let totalWinsInSystem = 0;

        allUsers.forEach(u => {
            totalDepositsInSystem += (u.wallets?.deposit || 0);
            totalWinsInSystem += (u.wallets?.win || 0);
        });

        res.status(200).json({ totalUsers, totalDepositsInSystem, totalWinsInSystem });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getLockedUsers = async (req, res) => {
    try {
        const lockedUsers = await User.find({ isLocked: true }).select('username email failedLoginAttempts');
        res.status(200).json({ success: true, users: lockedUsers });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; 
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.isLocked = false;
        user.failedLoginAttempts = 0;
        await user.save();

        res.status(200).json({ success: true, message: `Account ${user.username} has been UNBLOCKED!` });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.getDrawSettings = async (req, res) => {
    try {
        let settings = await DrawSettings.findOne();
        if (!settings) settings = await DrawSettings.create({}); 
        res.status(200).json({ success: true, settings });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.updateDrawSettings = async (req, res) => {
    try {
        const { nextWinningNumber, isRigged } = req.body; 
        let settings = await DrawSettings.findOne();
        if (!settings) settings = new DrawSettings();

        if (nextWinningNumber && nextWinningNumber.length === 4) {
            settings.nextWinners = [nextWinningNumber, '0000', '0000'];
        }
        if (typeof isRigged === 'boolean') settings.isRigged = isRigged;

        await settings.save();
        res.status(200).json({ success: true, message: "Draw settings updated successfully! 🔥", settings });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.getTicketStats = async (req, res) => {
    try {
        const pendingTickets = await Ticket.find({ status: 'pending' });
        let numberCounts = {};

        pendingTickets.forEach(t => {
            const num = t.chosenNumbers[0];
            if (num && num.length === 4) {
                numberCounts[num] = (numberCounts[num] || 0) + 1;
            }
        });

        let soldStats = [];
        for (let num in numberCounts) {
            soldStats.push({ number: num, count: numberCounts[num] });
        }
        soldStats.sort((a, b) => b.count - a.count);

        res.status(200).json({ success: true, stats: soldStats });
    } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

exports.changeUserPassword = async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ success: true, message: `Password for ${user.username} changed successfully!` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.adjustUserBalance = async (req, res) => {
    try {
        const { userId, walletType, amount, action } = req.body; 
        const numAmount = Number(amount);
        
        if (!numAmount || numAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!user.wallets) user.wallets = { deposit: 0, win: 0, reward: 0, bonus: 0 };
        if (user.wallets[walletType] === undefined) user.wallets[walletType] = 0;

        if (action === 'deduct') {
            if (user.wallets[walletType] < numAmount) {
                return res.status(400).json({ success: false, message: `User only has Rs. ${user.wallets[walletType]} in ${walletType} wallet!` });
            }
            user.wallets[walletType] -= numAmount;
        } else {
            user.wallets[walletType] += numAmount;
        }

        await user.save();

        await Transaction.create({
            userId: user._id,
            type: action === 'add' ? 'deposit' : 'withdraw',
            amount: numAmount,
            netAmount: action === 'add' ? numAmount : -numAmount,
            details: `Admin ${action === 'add' ? 'Added' : 'Deducted'} Rs. ${numAmount} ${action === 'add' ? 'to' : 'from'} ${walletType.toUpperCase()} wallet`,
            status: 'completed'
        });

        res.status(200).json({ success: true, message: `Successfully ${action === 'add' ? 'added' : 'deducted'} Rs. ${numAmount}.`, wallets: user.wallets });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.loginAsUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ success: true, token, user: { id: user._id, username: user.username, role: user.role } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getGlobalLedger = async (req, res) => {
    try {
        const history = await Transaction.find()
            .populate('userId', 'username') 
            .sort({ createdAt: -1 })
            .limit(200); 
            
        res.status(200).json({ success: true, history });
    } catch (error) { 
        res.status(500).json({ success: false, message: 'Server error', error: error.message }); 
    }
};

// ==========================================
// 🎰 THE AUTO DRAW ENGINE
// ==========================================
exports.runSlotMachineDraw = async () => {
    try {
        let settings = await DrawSettings.findOne();
        let winningDigits = settings && settings.isRigged ? settings.nextWinners[0] : Math.floor(1000 + Math.random() * 9000).toString();

        const pendingTickets = await Ticket.find({ status: 'pending' });

        for (let ticket of pendingTickets) {
            let isWinner = false;
            let prizeAmount = 0;
            const chosen = ticket.chosenNumbers[0]; 
            const pos = ticket.positions; 

            if (ticket.gameType === '4tune') {
                if (ticket.isStraight && chosen === winningDigits) {
                    isWinner = true; prizeAmount = 40000;
                } else if (ticket.isMixFix) {
                    let sortedChosen = chosen.split('').sort().join('');
                    let sortedWin = winningDigits.split('').sort().join('');
                    if (sortedChosen === sortedWin) {
                        isWinner = true; prizeAmount = 1500;
                    }
                }
            } else {
                let match = true;
                for (let p of pos) {
                    if (chosen[p] !== winningDigits[p]) {
                        match = false; break;
                    }
                }
                if (match) {
                    isWinner = true;
                    if (ticket.gameType === '3luck') prizeAmount = 4000;
                    else if (ticket.gameType === '2win') prizeAmount = 400;
                    else if (ticket.gameType === '1won') prizeAmount = 40;
                }
            }

            if (isWinner) {
                ticket.status = 'won';
                ticket.wonPrize = prizeAmount;
                const user = await User.findById(ticket.userId).populate('referredBy');
                
                if (user) {
                    user.wallets.win += prizeAmount;
                    
                    if (user.referredBy) {
                        const sponsor = await User.findById(user.referredBy._id);
                        if (sponsor) {
                            const commission = prizeAmount * 0.05;
                            sponsor.wallets.win += commission;
                            await sponsor.save();
                            await Transaction.create({ userId: sponsor._id, type: 'win', amount: commission, details: `Referral Win: 5% from ${user.username}` });

                            if (sponsor.referredBy) {
                                const grandSponsor = await User.findById(sponsor.referredBy);
                                if (grandSponsor) {
                                    grandSponsor.wallets.win += commission;
                                    await grandSponsor.save();
                                    await Transaction.create({ userId: grandSponsor._id, type: 'win', amount: commission, details: `G-Referral Win: 5% from ${user.username}` });
                                }
                            }
                        }
                    }
                    await user.save();
                    await Transaction.create({ userId: user._id, type: 'win', amount: prizeAmount, details: `🎰 Won Rs. ${prizeAmount} in Draw (${winningDigits})` });
                }
            } else {
                ticket.status = 'lost';
            }
            await ticket.save();
        }
    } catch (error) { console.log("Draw Error:", error); }
};

// ==========================================
// ⚠️ VIP RISK MANAGEMENT & PAYOUT PREDICTOR
// ==========================================
function getUniquePermutations(str) {
    let results = new Set();
    function permute(arr, memo) {
        let cur;
        memo = memo || "";
        if (arr.length === 0) results.add(memo);
        for (let i = 0; i < arr.length; i++) {
            cur = arr.splice(i, 1);
            permute(arr.slice(), memo + cur[0]);
            arr.splice(i, 0, cur[0]);
        }
    }
    permute(str.split(''));
    return Array.from(results);
}

function getMatchingCombinations(chosen, pos) {
    let results = [];
    let unselected = [0, 1, 2, 3].filter(p => !pos.includes(p));
    
    if (unselected.length === 1) {
        for(let i=0; i<=9; i++) {
            let arr = chosen.split(''); arr[unselected[0]] = i.toString(); results.push(arr.join(''));
        }
    } else if (unselected.length === 2) {
        for(let i=0; i<=9; i++) {
            for(let j=0; j<=9; j++) {
                let arr = chosen.split(''); arr[unselected[0]] = i.toString(); arr[unselected[1]] = j.toString(); results.push(arr.join(''));
            }
        }
    } else if (unselected.length === 3) {
        for(let i=0; i<=9; i++) {
            for(let j=0; j<=9; j++) {
                for(let k=0; k<=9; k++) {
                    let arr = chosen.split(''); arr[unselected[0]] = i.toString(); arr[unselected[1]] = j.toString(); arr[unselected[2]] = k.toString(); results.push(arr.join(''));
                }
            }
        }
    }
    return results;
}

exports.getRiskAnalysis = async (req, res) => {
    try {
        const { testNumber } = req.body;
        const pendingTickets = await Ticket.find({ status: 'pending' });
        
        let totalSales = 0;
        let liabilities = new Array(10000).fill(0); 

        for (let t of pendingTickets) {
            totalSales += (t.price || 5); 
            const chosen = t.chosenNumbers[0];
            const pos = t.positions;

            if (t.gameType === '4tune') {
                if (t.isStraight) liabilities[parseInt(chosen, 10)] += 40000;
                if (t.isMixFix) {
                    const perms = getUniquePermutations(chosen);
                    perms.forEach(p => { liabilities[parseInt(p, 10)] += 1500; });
                }
            } else {
                let prize = 0;
                if (t.gameType === '3luck') prize = 4000;
                else if (t.gameType === '2win') prize = 400;
                else if (t.gameType === '1won') prize = 40;

                const matches = getMatchingCombinations(chosen, pos);
                matches.forEach(m => { liabilities[parseInt(m, 10)] += prize; });
            }
        }

        let risks = [];
        for (let i = 0; i < 10000; i++) {
            if (liabilities[i] > 0) {
                risks.push({ number: i.toString().padStart(4, '0'), payout: liabilities[i] });
            }
        }
        
        risks.sort((a, b) => b.payout - a.payout);
        const top20 = risks.slice(0, 20);

        let testNumberPayout = null;
        if (testNumber && testNumber.length === 4) {
            testNumberPayout = liabilities[parseInt(testNumber, 10)] || 0;
        }

        res.status(200).json({ success: true, totalSales, top20, testNumberPayout });
    } catch (error) { 
        res.status(500).json({ success: false, message: error.message }); 
    }
};
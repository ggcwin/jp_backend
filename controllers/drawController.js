const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Draw = require('../models/Draw'); 
const moment = require('moment-timezone');

const runDailyDraw = async (manualNumber = null) => {
    try {
        const todayPKT = moment().tz("Asia/Karachi");
        const endTimePKT = todayPKT.clone().set({ hour: 22, minute: 57, second: 0, millisecond: 0 });
        const startTimePKT = todayPKT.clone().subtract(1, 'days').set({ hour: 23, minute: 1, second: 0, millisecond: 0 });
        const drawDateStr = todayPKT.format('YYYY-MM-DD');

        const winningNumber = manualNumber || Math.floor(1000 + Math.random() * 9000).toString();
        const lastDraw = await Draw.findOne().sort({ drawNumber: -1 });
        const currentDrawNumber = lastDraw ? lastDraw.drawNumber + 1 : 1;

        const tickets = await Ticket.find({ createdAt: { $gte: startTimePKT.toDate(), $lte: endTimePKT.toDate() }, status: 'pending' });
        const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);

        await Draw.create({
            drawNumber: currentDrawNumber, drawDate: drawDateStr, startTime: startTimePKT.toDate(),
            endTime: endTimePKT.toDate(), totalRevenue, winningNumber, status: 'completed'
        });

        const sortStr = (s) => s.split('').sort().join('');
        const sortedWin = sortStr(winningNumber);

        for (const ticket of tickets) {
            let winAmount = 0;
            const chosen = ticket.chosenNumbers.join('');

            if (ticket.gameType === '4tune') {
                if (ticket.isStraight && chosen === winningNumber) winAmount += 360;
                if (ticket.isMixFix && sortStr(chosen) === sortedWin) winAmount += 20;
            } else {
                let isMatch = true;
                for (let i = 0; i < ticket.positions.length; i++) {
                    if (winningNumber[ticket.positions[i]] !== ticket.chosenNumbers[i]) {
                        isMatch = false; break;
                    }
                }
                if (isMatch) {
                    if (ticket.gameType === '3luck') winAmount = 50;
                    if (ticket.gameType === '2win') winAmount = 10;
                    if (ticket.gameType === '1one') winAmount = 2;
                }
            }

            if (winAmount > 0) {
                const user = await User.findById(ticket.userId);
                if (user) {
                    user.wallets.win += winAmount;
                    await user.save();
                }
                ticket.status = 'won'; ticket.wonPrize = winAmount;
            } else {
                ticket.status = 'lost';
            }
            ticket.drawNumber = currentDrawNumber;
            await ticket.save();
        }
    } catch (err) { console.error("Draw Logic Error:", err); }
};

module.exports = { runDailyDraw };
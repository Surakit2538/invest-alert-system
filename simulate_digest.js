const WatchlistService = require('./functions/services/watchlistService');
const DailyDigestService = require('./functions/services/dailyDigestService');

async function runSimulation() {
    console.log('--- STARTING DAILY DIGEST SIMULATION (08:00 AM) ---\n');

    // 1. Setup Services
    const watchlistService = new WatchlistService(null); // null DB = use mock
    const digestService = new DailyDigestService(watchlistService);

    // 2. Run Digest for a Dummy User
    const userId = 'user_123';
    const digest = await digestService.generateDigest(userId);

    // 3. Print the "LINE Message" Output
    console.log('\n--- LINE MESSAGE PREVIEW ---');

    if (digest.buySignals.length === 0 && digest.sellSignals.length === 0) {
        console.log('(No message sent - Silent Mode applied)');
        return;
    }

    console.log(`📊 สรุปสัญญาณวันนี้ (${digest.date})`);
    console.log(`--------------------------------`);

    if (digest.buySignals.length > 0) {
        console.log(`\n🟢 สินทรัพย์ที่ควรซื้อ (${digest.buySignals.length} รายการ):`);
        digest.buySignals.forEach((sig, i) => {
            console.log(`${i + 1}. ${sig.symbol} - ${sig.grade} (Conf: ${sig.confidence}%)`);
            console.log(`   เหตุผล: ${sig.reasons.join(', ')}`);
        });
    }

    if (digest.sellSignals.length > 0) {
        console.log(`\n🔴 สินทรัพย์ที่ควรขาย (${digest.sellSignals.length} รายการ):`);
        digest.sellSignals.forEach((sig, i) => {
            console.log(`${i + 1}. ${sig.symbol} - ${sig.grade} (Conf: ${sig.confidence}%)`);
            console.log(`   เหตุผล: ${sig.reasons.join(', ')}`);
        });
    }

    if (digest.neutralSignals.length > 0) {
        console.log(`\n🟡 รายการอื่นๆ (${digest.neutralSignals.length} รายการ):`);
        console.log(`   ยังไม่มีสัญญาณชัดเจน - ถือต่อ`);
    }

    console.log('\n[ดูรายละเอียด] [จัดการ Watchlist]');
    console.log('--------------------------------');
}

runSimulation();

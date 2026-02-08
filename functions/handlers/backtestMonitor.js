const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { fetchStockPrice } = require('../utils/dataAggregator'); // Or use yahooFinance directly

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Checks the accuracy of past analysis (Backtesting/Forward Testing)
 * callable from frontend via fetch: /checkBacktestAccuracy?userId=...
 */
exports.checkBacktestAccuracy = onRequest(async (request, response) => {
    cors(request, response, async () => {
        const userId = request.query.userId || request.body.userId;
        if (!userId) return response.status(400).json({ error: "UserId required" });

        try {
            const historyRef = db.collection('users').doc(userId).collection('analysis_history');
            // Get active items (or all pending items)
            const snapshot = await historyRef.where('status', '==', 'active').get();

            if (snapshot.empty) return response.json({ message: "No active analysis to check." });

            const updates = [];
            const results = [];

            // 1. Collect Items
            const items = [];
            snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

            // 2. Process
            for (const item of items) {
                try {
                    // Fetch Price
                    const priceData = await fetchStockPrice(item.symbol);

                    if (priceData) {
                        const currentPrice = priceData.price;
                        const entryPrice = item.priceAtAnalysis;

                        // Skip if entry price invalid
                        if (!entryPrice) continue;

                        const returnPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

                        const isBuy = (item.recommendation || '').includes('BUY');
                        const isSell = (item.recommendation || '').includes('SELL');

                        let isProfitable = false;
                        if (isBuy && returnPercent > 0) isProfitable = true;
                        if (isSell && returnPercent < 0) isProfitable = true;

                        // Update Firestore
                        updates.push(historyRef.doc(item.id).update({
                            currentPrice: currentPrice,
                            returnPercent: parseFloat(returnPercent.toFixed(2)),
                            lastChecked: Date.now(),
                            isProfitable: isProfitable
                        }));

                        results.push({
                            symbol: item.symbol,
                            return: returnPercent.toFixed(2) + '%',
                            isProfitable: isProfitable
                        });
                    }
                } catch (e) {
                    console.error(`Error processing ${item.symbol}:`, e);
                }
            }

            await Promise.all(updates);
            response.json({ success: true, updated: updates.length, details: results });

        } catch (e) {
            console.error("Backtest Error:", e);
            response.status(500).json({ error: e.message });
        }
    });
});

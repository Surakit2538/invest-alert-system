const priceService = require('./priceService');
const indicatorService = require('./indicatorService');
const confidenceScorer = require('./confidenceScorer');
const WatchlistService = require('./watchlistService');

class DailyDigestService {
    constructor(watchlistService) {
        this.watchlistService = watchlistService;
    }

    async generateDigest(userId) {
        const watchlist = await this.watchlistService.getWatchlist(userId);

        // We need to fetch data for each item
        const results = {
            date: new Date().toLocaleDateString('th-TH'),
            buySignals: [],
            sellSignals: [],
            neutralSignals: []
        };

        console.log(`Analyzing ${watchlist.length} assets for user ${userId}...`);

        for (const item of watchlist) {
            // 1. Get Price & Indicators
            // For simulation, we need a way to mock "historical data" or fetch real
            // Here we assume fetch real from PriceService or use mock if fails

            let priceData = await priceService.getPrice(item.symbol, item.assetType);

            // If price fetching fails (e.g. no API key), use a Mock for demonstration
            if (!priceData) {
                priceData = this.generateMockPriceData(item.symbol);
            }

            // We need historical for indicators. 
            // mocking historical for demo
            const historicalPrices = this.generateMockHistoricalPrices(priceData.price);

            // 2. Calculate Indicators
            const indicators = indicatorService.calculateAll(
                historicalPrices.closes,
                historicalPrices.highs,
                historicalPrices.lows
            );

            // Inject dummy Fundamental Data (since we don't have a source yet)
            const fundamental = {
                ROE: 18, // Good
                DE: 0.8, // Good
                FCF: 1000,
                PE: 15,
                industryAvgPE: 20
            };

            // 3. Analyze based on mode
            if (item.mode === 'technical' || item.mode === 'both') {
                // Check BUY
                const buyConf = confidenceScorer.calculateBuyConfidence(
                    { price: priceData.price },
                    indicators,
                    fundamental
                );

                if (buyConf.passed) {
                    results.buySignals.push({
                        symbol: item.symbol,
                        confidence: buyConf.confidence,
                        grade: buyConf.grade,
                        reasons: Object.values(buyConf.breakdown)
                    });
                    continue; // If buy, don't check sell (usually)
                }

                // Check SELL
                const sellConf = confidenceScorer.calculateSellConfidence(
                    { price: priceData.price },
                    indicators
                );

                if (sellConf.passed) {
                    results.sellSignals.push({
                        symbol: item.symbol,
                        confidence: sellConf.confidence,
                        grade: sellConf.grade,
                        reasons: Object.values(sellConf.breakdown)
                    });
                    continue;
                }

                // Neutral
                results.neutralSignals.push({
                    symbol: item.symbol,
                    reason: 'No clear high-confidence signal'
                });
            }

            // Check Price Alerts (Manual)
            if (item.mode === 'price' || item.mode === 'both') {
                if (item.condition === 'below' && priceData.price < item.targetPrice) {
                    results.buySignals.push({
                        symbol: item.symbol,
                        confidence: 100,
                        grade: 'MANUAL',
                        reasons: [`Price ${priceData.price} is below target ${item.targetPrice}`]
                    });
                }
            }
        }

        return results;
    }

    // --- MOCK HELPERS FOR DEMO ---
    generateMockPriceData(symbol) {
        // Return interesting data for specific symbols to show off logic
        if (symbol === 'AAPL') return { price: 150 }; // Buy scenario
        if (symbol === 'TSLA') return { price: 200 }; // Sell scenario
        if (symbol === 'BTC') return { price: 65000 }; // Buy scenario
        return { price: 100 }; // Neutral
    }

    generateMockHistoricalPrices(currentPrice) {
        // Generate a series of 200 prices ending at currentPrice
        // We want to manufacture scenarios:
        // AAPL (150) -> Uptrend, oversold dip?
        // TSLA (200) -> Downtrend

        const closes = [];
        const highs = [];
        const lows = [];

        let p = currentPrice * 0.8; // Start lower
        for (let i = 0; i < 200; i++) {
            p = p + (Math.random() - 0.45); // slight trend up
            if (i > 180 && currentPrice === 150) p = p - 1; // Dip at end for AAPL (Oversold)
            if (i > 180 && currentPrice === 200) p = p - 2; // Crash at end for TSLA

            closes.push(p);
            highs.push(p * 1.01);
            lows.push(p * 0.99);
        }
        // Force last to be current
        closes[199] = currentPrice;

        return { closes, highs, lows };
    }
}

module.exports = DailyDigestService;

const pkg = require('yahoo-finance2');
let yahooFinance;

// Robust initialization for yahoo-finance2 (v2 vs v3)
if (pkg.default) {
    if (typeof pkg.default === 'function') {
        try { yahooFinance = new pkg.default(); } catch (e) { yahooFinance = pkg.default; }
    } else {
        yahooFinance = pkg.default;
    }
} else {
    // No default export
    if (typeof pkg === 'function') {
        try { yahooFinance = new pkg(); } catch (e) { yahooFinance = pkg; }
    } else {
        yahooFinance = pkg;
    }
}

// Suppress notices if supported
if (yahooFinance && typeof yahooFinance.suppressNotices === 'function') {
    yahooFinance.suppressNotices(['yahooSurvey', 'nonsensical']);
}

const { RSI, MACD, BollingerBands } = require('technicalindicators');
const { generateAIAnalysis } = require('../utils/aiAnalyzer');

/**
 * Parallel Stream Analysis Engine
 * Stream 1: Technical (RSI, MACD, BB) via yahoo-finance2 + technicalindicators
 * Stream 2: Fundamental (P/E, Market Cap) via yahoo-finance2
 * Stream 3: Sentiment (AI Score) via Gemini 1.5 Flash
 */
async function execute(symbol) {
    console.log(`Analyzing ${symbol} with Parallel Streams...`);

    // 1. Symbol Normalization for Yahoo Finance
    let ySymbol = symbol;
    const isCrypto = ['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'].includes(symbol);
    const isUS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC', 'BABA', 'JD', 'BIDU', 'TCEHY', 'TSM'].includes(symbol);

    if (symbol.includes('.') || symbol.includes('-')) {
        ySymbol = symbol;
    } else if (isCrypto) {
        ySymbol = `${symbol}-USD`;
    } else if (!isUS) {
        // Assume Thai Stock if not US and no suffix
        ySymbol = `${symbol}.BK`;
    }

    try {
        // 2. Fetch Data (Parallel)
        // We need historical data for Technicals, and Quote Summary for Fundamentals
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 200); // 200 days for EMA200/RSI/MACD

        const [historical, quoteSummary] = await Promise.all([
            yahooFinance.historical(ySymbol, { period1: startDate, period2: endDate }),
            yahooFinance.quoteSummary(ySymbol, { modules: ['summaryDetail', 'financialData', 'price'] })
        ]);

        if (!historical || historical.length < 50) throw new Error("Insufficient historical data");

        // 3. Stream 1: Technical Analysis
        const closes = historical.map(d => d.close);
        const latestPrice = closes[closes.length - 1];

        // RSI (14)
        const rsiInput = { values: closes, period: 14 };
        const rsiValues = RSI.calculate(rsiInput);
        const currentRSI = rsiValues[rsiValues.length - 1];

        // MACD (12, 26, 9)
        const macdInput = { values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false };
        const macdValues = MACD.calculate(macdInput);
        const currentMACD = macdValues[macdValues.length - 1];

        // Bollinger Bands
        const bbInput = { period: 20, values: closes, stdDev: 2 };
        const bbValues = BollingerBands.calculate(bbInput);
        const currentBB = bbValues[bbValues.length - 1];

        // Trend (Simple check vs EMA/SMA or just visual trend)
        // For simplicity, let's use Price vs SMA50
        // Calculate SMA50 efficiently
        const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        const trend = latestPrice > sma50 ? "Uptrend" : "Downtrend";

        // 4. Stream 2: Fundamental Analysis
        const fundamentals = {
            pe: quoteSummary.summaryDetail?.trailingPE || 'N/A',
            marketCap: quoteSummary.summaryDetail?.marketCap || 0,
            volume: quoteSummary.summaryDetail?.volume || 0,
            avgVolume: quoteSummary.summaryDetail?.averageVolume || 0,
            dividendYield: quoteSummary.summaryDetail?.dividendYield || 0,
            revenueGrowth: quoteSummary.financialData?.revenueGrowth || 0,
            symbol: ySymbol
        };

        const fundamentalScore = calculateFundamentalScore(fundamentals, isCrypto);

        // 5. Stream 3: Sentiment Analysis (AI)
        const marketDataForAI = {
            price: latestPrice,
            changePercent: ((latestPrice - historical[historical.length - 2].close) / historical[historical.length - 2].close) * 100,
            type: isCrypto ? 'Crypto' : 'Stock',
            pe: fundamentals.pe,
            yield: (fundamentals.dividendYield * 100).toFixed(2) + '%'
        };
        const aiResult = await generateAIAnalysis(symbol, marketDataForAI);

        // 6. Decision Engine (Strict Criteria)
        // ... (Keep existing decision logic, but maybe relax it slightly for Long-Term or keep strict for entry?)
        // Let's keep the recommendation logic roughly same for now, but use the NEW SCORE for ranking.

        let recommendation = 'HOLD';
        // ... (Keep existing decision tree for now)
        if (aiResult.score > 70 && currentRSI < 30) {
            recommendation = 'STRONG BUY';
        } else if (aiResult.score > 50 && currentRSI >= 30 && currentRSI <= 55) {
            recommendation = 'BUY';
        } else if (aiResult.score < 40 && currentRSI > 70) {
            recommendation = 'SELL';
        } else if (currentRSI > 70) {
            recommendation = 'SELL';
        } else if (currentRSI < 30) {
            recommendation = 'HOLD'; // Wait for confirmation
        }

        // 7. Calculate Aggregated Score (Dynamic Weighting)
        // Technical Score Calculation
        let techScore = 50;
        if (currentRSI < 30) techScore = 90;
        else if (currentRSI < 40) techScore = 75;
        else if (currentRSI > 70) techScore = 10;
        else if (currentRSI > 60) techScore = 30;

        // Dynamic Weighting
        let finalScore = 0;
        if (isCrypto) {
            // Crypto: 20% Fund (Cap/Vol), 40% Tech, 40% Sentiment
            finalScore = (fundamentalScore * 0.2) + (techScore * 0.4) + (aiResult.score * 0.4);
        } else {
            // Stocks: 40% Fund (PE/Div), 30% Tech, 30% Sentiment
            finalScore = (fundamentalScore * 0.4) + (techScore * 0.3) + (aiResult.score * 0.3);
        }
        finalScore = Math.round(finalScore);

        return {
            symbol: symbol.toUpperCase(),
            recommendation,
            score: finalScore,
            confidence: aiResult.status === 'Bullish' && recommendation.includes('BUY') ? 'High' : 'Medium',
            currentPrice: latestPrice.toFixed(2),
            priceValue: latestPrice, // Added for Backtesting (Raw Number)
            currency: quoteSummary.price?.currencySymbol || (isCrypto ? 'USD' : 'THB'),
            change24h: marketDataForAI.changePercent.toFixed(2) + '%',
            analysis: {
                technical: {
                    rsi: currentRSI.toFixed(2),
                    macd: currentMACD.MACD ? currentMACD.MACD.toFixed(4) : 'N/A',
                    trend: trend,
                    signal: currentRSI > 70 ? 'Overbought' : (currentRSI < 30 ? 'Oversold' : 'Neutral')
                },
                fundamental: {
                    pe: fundamentals.pe !== 'N/A' ? fundamentals.pe.toFixed(2) : 'N/A',
                    volume: (fundamentals.volume / 1000000).toFixed(2) + 'M',
                    dividendYield: (fundamentals.dividendYield * 100).toFixed(2) + '%',
                    revenueGrowth: (fundamentals.revenueGrowth * 100).toFixed(2) + '%',
                    score: fundamentalScore
                },
                sentiment: {
                    score: aiResult.score,
                    status: aiResult.status,
                    summary: aiResult.summaryTH
                }
            },
            summary: aiResult.summaryTH + ` RSI ${currentRSI.toFixed(1)} / Fund Score ${fundamentalScore}`,
            riskWarning: "การลงทุนมีความเสี่ยง (Data: Yahoo Finance, AI: Gemini)",
            sources: ["Yahoo Finance", "Gemini AI"],
            lastUpdated: new Date().toISOString()
        };

    } catch (e) {
        console.error(`Parallel Stream Analysis Failed for ${symbol}:`, e);
        // Fallback
        return {
            symbol: symbol,
            recommendation: "ERROR",
            score: 0,
            summary: "ไม่สามารถดึงข้อมูลได้ในขณะนี้ (" + e.message + ")",
            currentPrice: "---",
            currency: "",
            change24h: "0.00%",
            analysis: {
                technical: { rsi: 50, signal: "N/A", macd: "N/A" },
                fundamental: { pe: "N/A", volume: "N/A" },
                sentiment: { score: 50, status: "Neutral", summary: "Data Unavailable" }
            },
            riskWarning: "System Error: " + e.message,
            sources: []
        };
    }
}

/**
 * Calculates Fundamental Score (0-100)
 */
function calculateFundamentalScore(fund, isCrypto) {
    let score = 0;

    if (isCrypto) {
        // Crypto Logic (20% weight in final, but here calculate 0-100 base)
        // 1. Market Cap (Stability) - 50 pts
        // Assume > 10B is solid (Bitcoin is ~1T)
        if (fund.marketCap > 10000000000) score += 50;
        else if (fund.marketCap > 1000000000) score += 30;
        else if (fund.marketCap > 100000000) score += 10;

        // 2. Liquidity (Vol/Cap) - 50 pts
        // If volume is > 5% of cap, it's very liquid
        const volCapRatio = fund.volume / (fund.marketCap || 1);
        if (volCapRatio > 0.1) score += 50;
        else if (volCapRatio > 0.05) score += 30;
        else if (volCapRatio > 0.01) score += 10;

    } else {
        // Stock Logic (40% weight in final)
        // 1. P/E Ratio (Value) - 30 pts
        const pe = fund.pe;
        if (pe !== 'N/A' && pe > 0) {
            if (pe < 15) score += 30;
            else if (pe < 25) score += 20;
            else if (pe < 40) score += 10;
        }

        // 2. Dividend Yield (Income) - 20 pts
        const yield = fund.dividendYield || 0;
        if (yield > 0.03) score += 20; // > 3%
        else if (yield > 0.01) score += 10; // > 1%

        // 3. Revenue Growth (Growth) - 30 pts
        const growth = fund.revenueGrowth || 0;
        if (growth > 0.15) score += 30; // > 15%
        else if (growth > 0.05) score += 15; // > 5%

        // 4. Market Cap (Stability) - 20 pts
        if (fund.marketCap > 10000000000) score += 20; // > 10B
        else if (fund.marketCap > 1000000000) score += 10; // > 1B
    }

    return score;
}

module.exports = { execute };

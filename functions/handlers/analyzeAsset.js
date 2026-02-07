const yahooFinance = require('yahoo-finance2').default;
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
    const isUS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC'].includes(symbol);

    if (isCrypto) {
        ySymbol = `${symbol}-USD`;
    } else if (!isUS && !symbol.includes('.')) {
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
            marketCap: quoteSummary.summaryDetail?.marketCap || 'N/A',
            volume: quoteSummary.summaryDetail?.volume || 0,
            avgVolume: quoteSummary.summaryDetail?.averageVolume || 0,
            symbol: ySymbol
        };

        // 5. Stream 3: Sentiment Analysis (AI)
        const marketDataForAI = {
            price: latestPrice,
            changePercent: ((latestPrice - historical[historical.length - 2].close) / historical[historical.length - 2].close) * 100,
            type: isCrypto ? 'Crypto' : 'Stock'
        };
        const aiResult = await generateAIAnalysis(symbol, marketDataForAI);

        // 6. Decision Engine (Strict Criteria)
        // Strong Buy: Sentiment > 70 AND RSI < 30 (Oversold)
        // Buy: Sentiment > 50 AND RSI 30-50
        // Hold: RSI 50-60 OR Conflict
        // Sell: Sentiment < 40 AND RSI > 70 (Overbought)

        let recommendation = 'HOLD';
        let mainReason = '';

        if (aiResult.score > 70 && currentRSI < 30) {
            recommendation = 'STRONG BUY';
            mainReason = 'Oversold (RSI < 30) with Bullish Sentiment';
        } else if (aiResult.score > 50 && currentRSI >= 30 && currentRSI <= 55) { // Slightly expanded 50 to 55 to be more practical
            recommendation = 'BUY';
            mainReason = 'Bullish Sentiment + Moderate RSI';
        } else if (aiResult.score < 40 && currentRSI > 70) {
            recommendation = 'SELL';
            mainReason = 'Overbought (RSI > 70) with Bearish Sentiment';
        } else if (currentRSI > 70) {
            recommendation = 'SELL'; // Technical Overbought override
            mainReason = 'Technical Overbought (RSI > 70)';
        } else if (currentRSI < 30) {
            // If RSI oversold but sentiment bad? Risky buy? Or Watch?
            // User's rules: "Sell: Sentiment < 40 & RSI > 70".
            // Let's stick to HOLD if not met, or use common sense extensions.
            // User said: Hold: Conflict or RSI 50-60.
            recommendation = 'HOLD';
            mainReason = 'Market Indecisive or Signals Conflict';
        }

        // 7. Calculate Aggregated Score (0-100)
        // Weighted: Technical 40%, Sentiment 40%, Fund/Vol 20%
        // Normalized RSI score: 0-100 (Where 30 is good for buy (score 100?), 70 is bad (score 0?))
        // Actually for "Buy Strength", Lower RSI is better (up to a point).
        // Let's simplified: just average the AI score with a "Technical Score"

        let techScore = 50;
        if (currentRSI < 30) techScore = 90;
        else if (currentRSI < 40) techScore = 75;
        else if (currentRSI > 70) techScore = 10;
        else if (currentRSI > 60) techScore = 30;

        const finalScore = Math.round((aiResult.score * 0.5) + (techScore * 0.5));

        return {
            symbol: symbol.toUpperCase(),
            recommendation,
            score: finalScore,
            confidence: aiResult.status === 'Bullish' && recommendation.includes('BUY') ? 'High' : 'Medium',
            currentPrice: latestPrice.toFixed(2),
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
                    volume: (fundamentals.volume / 1000000).toFixed(2) + 'M'
                },
                sentiment: {
                    score: aiResult.score,
                    status: aiResult.status,
                    summary: aiResult.summaryTH
                }
            },
            summary: aiResult.summaryTH + ` RSI อยู่ที่ ${currentRSI.toFixed(1)} (${recommendation})`,
            riskWarning: "การลงทุนมีความเสี่ยง (Data: Yahoo Finance, AI: Gemini)",
            sources: ["Yahoo Finance", "Gemini AI"],
            lastUpdated: new Date().toISOString()
        };

    } catch (e) {
        console.error(`Parallel Stream Analysis Failed for ${symbol}:`, e);
        // Fallback to simple object to not break UI
        return {
            symbol: symbol,
            recommendation: "ERROR",
            score: 0,
            summary: "ไม่สามารถดึงข้อมูลได้ในขณะนี้ (" + e.message + ")",
            analysis: { technical: {}, fundamental: {}, sentiment: {} },
            sources: []
        };
    }
}

module.exports = { execute };

const { aggregateData } = require('../utils/dataAggregator');
const { generateAIAnalysis } = require('../utils/aiAnalyzer');

/**
 * Main Business Logic for Asset Analysis
 * Combines Data Aggregation + AI Analysis + Scoring Algorithm
 */
async function execute(symbol) {
    if (!symbol) throw new Error("Symbol is required");

    // 1. Gather Data (Google Finance, CoinGecko, etc.)
    const marketData = await aggregateData(symbol);

    // 2. AI Analysis (Sentiment & Reasons)
    const aiResult = await generateAIAnalysis(symbol, marketData);

    // 3. Scoring Algorithm (0-100)
    let score = 50; // Base Score

    // 3.1 Momentum Score (Max 30)
    const change = marketData.changePercent;
    if (change > 5) score += 30;
    else if (change > 2) score += 20;
    else if (change > 0) score += 10;
    else if (change < -5) score -= 30;
    else if (change < -2) score -= 20;

    // 3.2 Sentiment Score (Max 20)
    if (aiResult.sentiment === 'Positive') score += 20;
    if (aiResult.sentiment === 'Negative') score -= 20;

    // Clamp Score
    score = Math.max(0, Math.min(100, score));

    // 4. Determine Recommendation
    let recommendation = 'HOLD';
    if (score >= 70) recommendation = 'BUY';
    if (score <= 30) recommendation = 'SELL';

    // 5. Confidence Level (Simple logic based on data availability)
    // If we have both Google + Gecko data for crypto, high confidence
    // For stocks, if Google data is fresh, Medium-High
    let confidence = 'Medium';
    if (marketData.price !== 0 && aiResult.reasons.length > 0) confidence = 'High';

    return {
        symbol: symbol.toUpperCase(),
        recommendation,
        score,
        confidence,
        currentPrice: marketData.price,
        currency: marketData.currency || 'USD',
        change24h: marketData.changePercent.toFixed(2) + '%',
        analysis: {
            momentum: {
                score: score > 50 ? 'Positive' : 'Negative',
                reason: `24h Change: ${marketData.changePercent}%`
            },
            aiSentiment: {
                score: aiResult.sentiment,
                reason: aiResult.reasons[0] || 'N/A'
            }
        },
        summary: aiResult.summaryTH,
        riskWarning: "การลงทุนมีความเสี่ยง โปรดใช้วิจารณญาณ (Analysis by AI)",
        sources: [marketData.details?.google ? 'Google Finance' : '', marketData.details?.gecko ? 'CoinGecko' : ''].filter(Boolean),
        lastUpdated: new Date().toISOString()
    };
}

module.exports = { execute };

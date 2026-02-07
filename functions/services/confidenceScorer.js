/**
 * Calculator for Signal Confidence Score
 * Criteria: >= 80% to notify
 */
class ConfidenceScorer {

    /**
     * Calculate confidence for BUY signal
     * @param {Object} asset - Asset data
     * @param {Object} indicators - Calculated indicators
     * @param {Object} fundamental - Fundamental data (optional)
     */
    calculateBuyConfidence(asset, indicators, fundamental = {}) {
        let score = 0;
        const breakdown = {};

        // === Fundamental Score (Max 40 points) ===
        // If no fundamental data, we might scale technical to 100% or assume neutral
        // For this implementation, we'll assume Technical is main driver if Fundamental missing,
        // but having it boosts confidence significantly.

        let fundamentalScore = 0;
        if (fundamental.ROE > 15) { fundamentalScore += 10; breakdown.ROE = '✅ ROE > 15%'; }
        if (fundamental.DE < 1) { fundamentalScore += 10; breakdown.DE = '✅ Low Debt'; }
        if (fundamental.FCF > 0) { fundamentalScore += 10; breakdown.FCF = '✅ Positive Cash Flow'; }
        if (fundamental.PE && fundamental.industryAvgPE && fundamental.PE < fundamental.industryAvgPE * 1.2) {
            fundamentalScore += 10; breakdown.PE = '✅ Fair P/E';
        }

        score += fundamentalScore;

        // === Technical Score (Max 60 points) ===
        let technicalScore = 0;

        // RSI (15 points)
        if (indicators.RSI < 30) {
            technicalScore += 15;
            breakdown.RSI = '⭐ RSI < 30 (Oversold)';
        } else if (indicators.RSI < 40) {
            technicalScore += 10;
            breakdown.RSI = '✅ RSI < 40';
        } else if (indicators.RSI < 50) {
            technicalScore += 5;
            breakdown.RSI = '🟡 RSI < 50';
        }

        // MACD (20 points)
        if (indicators.MACD && indicators.MACD.histogram > 0 &&
            indicators.MACD.MACD > indicators.MACD.signal) {
            if (indicators.MACD.histogram > (indicators.MACD.previousHistogram || 0)) {
                technicalScore += 20;
                breakdown.MACD = '⭐ MACD Bullish & Rising';
            } else {
                technicalScore += 15;
                breakdown.MACD = '✅ MACD Bullish';
            }
        }

        // Moving Average (10 points)
        if (indicators.MA && asset.price > indicators.MA.SMA200) {
            technicalScore += 10;
            breakdown.MA = '✅ Price > MA200 (Uptrend)';
        } else if (indicators.MA && asset.price > indicators.MA.SMA200 * 0.95) {
            technicalScore += 5;
            breakdown.MA = '🟡 Price near MA200';
        }

        // Volume (10 points)
        if (indicators.volume > indicators.avgVolume * 1.5) {
            technicalScore += 10;
            breakdown.Volume = '✅ Volume Spike (+50%)';
        } else if (indicators.volume > indicators.avgVolume * 1.2) {
            technicalScore += 5;
            breakdown.Volume = '🟡 Volume Up (+20%)';
        }

        // ADX (5 points)
        if (indicators.ADX && indicators.ADX.adx > 25) {
            technicalScore += 5;
            breakdown.ADX = '✅ Strong Trend (ADX>25)';
        }

        score += technicalScore;

        // If fundamental is missing, we might want to scale technical score
        // e.g. score = (technicalScore / 60) * 100
        // But per user req, we want HIGH confidence.

        const confidence = Math.round(score);

        // Check Threshold
        if (confidence < 80) {
            return {
                confidence,
                passed: false,
                reason: `Confidence ${confidence}% < 80%`,
                breakdown
            };
        }

        return {
            confidence,
            passed: true,
            grade: confidence >= 90 ? 'A+' : confidence >= 85 ? 'A' : 'B+',
            breakdown,
            recommendation: confidence >= 80 ? 'STRONG BUY' : 'BUY'
        };
    }

    /**
     * Calculate confidence for SELL signal
     */
    calculateSellConfidence(asset, indicators) {
        let score = 0;
        const breakdown = {};

        // Death Cross (30 points)
        if (indicators.MA && indicators.MA.EMA50 < indicators.MA.SMA200) {
            // We'd ideally check if it JUST crossed, but for now:
            score += 20;
            breakdown.DeathCross = '🔴 Death Cross (50 < 200)';
        }

        // MA200 Breakdown (25 points)
        if (indicators.MA && asset.price < indicators.MA.SMA200 * 0.95) {
            score += 25;
            breakdown.MA200 = '🔴 Breakdown MA200 significantly';
        } else if (indicators.MA && asset.price < indicators.MA.SMA200) {
            score += 15;
            breakdown.MA200 = '⚠️ Price < MA200';
        }

        // MACD Bearish (20 points)
        if (indicators.MACD && indicators.MACD.MACD < indicators.MACD.signal) {
            if (indicators.MACD.histogram < -2) {
                score += 20;
                breakdown.MACD = '🔴 MACD Strong Bearish';
            } else {
                score += 10;
                breakdown.MACD = '⚠️ MACD Bearish';
            }
        }

        // RSI (15 points)
        if (indicators.RSI > 80) {
            score += 15;
            breakdown.RSI = '🔴 RSI Extremely Overbought (>80)';
        } else if (indicators.RSI > 70) {
            score += 10;
            breakdown.RSI = '⚠️ RSI Overbought (>70)';
        }

        const confidence = Math.round(score);

        if (confidence < 80) {
            return {
                confidence,
                passed: false,
                reason: `Confidence ${confidence}% < 80%`,
                breakdown
            };
        }

        return {
            confidence,
            passed: true,
            grade: confidence >= 90 ? 'A+' : confidence >= 85 ? 'A' : 'B+',
            breakdown,
            recommendation: confidence >= 80 ? 'STRONG SELL' : 'SELL'
        };
    }
}

module.exports = new ConfidenceScorer();

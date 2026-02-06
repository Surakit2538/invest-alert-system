const SMA = require('technicalindicators').SMA;
const EMA = require('technicalindicators').EMA;
const RSI = require('technicalindicators').RSI;
const MACD = require('technicalindicators').MACD;
const BollingerBands = require('technicalindicators').BollingerBands;
const ADX = require('technicalindicators').ADX;

class IndicatorService {

    /**
     * Calculate all key indicators for an asset
     * @param {number[]} prices - Array of closing prices (oldest to newest)
     * @param {number[]} highs - Array of high prices (for ADX)
     * @param {number[]} lows - Array of low prices (for ADX)
     */
    calculateAll(prices, highs = [], lows = []) {
        if (!prices || prices.length < 50) {
            return { status: 'INSUFFICIENT_DATA' };
        }

        return {
            RSI: this.calculateRSI(prices),
            MACD: this.calculateMACD(prices),
            BB: this.calculateBollingerBands(prices),
            MA: this.calculateMAs(prices),
            ADX: this.calculateADX(highs, lows, prices)
        };
    }

    calculateRSI(prices, period = 14) {
        const results = RSI.calculate({
            values: prices,
            period: period
        });
        // Return last value
        return results[results.length - 1];
    }

    calculateMACD(prices) {
        const results = MACD.calculate({
            values: prices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        return results[results.length - 1]; // { MACD, signal, histogram }
    }

    calculateBollingerBands(prices) {
        const results = BollingerBands.calculate({
            period: 20,
            values: prices,
            stdDev: 2
        });
        return results[results.length - 1]; // { middle, upper, lower }
    }

    calculateMAs(prices) {
        const sma200 = SMA.calculate({ period: 200, values: prices });
        const ema50 = EMA.calculate({ period: 50, values: prices });
        const ema200 = EMA.calculate({ period: 200, values: prices });

        return {
            SMA200: sma200[sma200.length - 1],
            EMA50: ema50[ema50.length - 1],
            EMA200: ema200[ema200.length - 1]
        };
    }

    calculateADX(highs, lows, closes) {
        if (highs.length === 0) return null;

        const results = ADX.calculate({
            high: highs,
            low: lows,
            close: closes,
            period: 14
        });
        return results[results.length - 1]; // { adx, pdi, mdi }
    }

    /**
     * Analyze for Buy/Sell Signals based on calculated indicators
     */
    analyzeSignals(indicators, currentPrice) {
        const signals = [];
        let score = 0; // 0 to 100

        // 1. RSI Analysis
        if (indicators.RSI < 30) {
            signals.push('RSI Oversold (<30)');
            score += 20;
        } else if (indicators.RSI > 70) {
            signals.push('RSI Overbought (>70)');
            score -= 20;
        }

        // 2. MACD Analysis
        if (indicators.MACD) {
            if (indicators.MACD.MACD > indicators.MACD.signal) {
                signals.push('MACD Bullish Cross');
                score += 15;
            } else {
                signals.push('MACD Bearish Cross');
                score -= 15;
            }
        }

        // 3. Moving Average Analysis (Trend)
        if (indicators.MA.SMA200) {
            if (currentPrice > indicators.MA.SMA200) {
                signals.push('Price > 200 SMA (Uptrend)');
                score += 10;
            } else {
                signals.push('Price < 200 SMA (Downtrend)');
                score -= 10;
            }
        }

        // 4. Bollinger Bands
        if (indicators.BB) {
            if (currentPrice < indicators.BB.lower) {
                signals.push('Price below Lower Band (Potential Buy)');
                score += 15;
            } else if (currentPrice > indicators.BB.upper) {
                signals.push('Price above Upper Band (Potential Sell)');
                score -= 15;
            }
        }

        // Normalize Score
        // Simplified Logic: > 30 is BUY, < -30 is SELL
        let recommendation = 'NEUTRAL';
        if (score >= 40) recommendation = 'STRONG_BUY';
        else if (score >= 20) recommendation = 'BUY';
        else if (score <= -40) recommendation = 'STRONG_SELL';
        else if (score <= -20) recommendation = 'SELL';

        return {
            recommendation,
            score,
            signals
        };
    }
}

module.exports = new IndicatorService();

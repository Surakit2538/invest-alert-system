const axios = require('axios');
const cheerio = require('cheerio'); // For scraping if needed

class PriceService {
    constructor() {
        this.finnhubApiKey = process.env.FINNHUB_API_KEY || 'YOUR_FINNHUB_KEY';
    }

    /**
     * Get current price for an asset
     * @param {string} symbol - Ticker symbol (e.g., 'AAPL', 'BTC', 'PTT.BK')
     * @param {string} type - 'us-stock', 'crypto', 'thai-stock', 'gold'
     */
    async getPrice(symbol, type) {
        switch (type) {
            case 'crypto':
                return this.getCryptoPrice(symbol);
            case 'us-stock':
                return this.getUSStockPrice(symbol);
            case 'thai-stock':
                return this.getThaiStockPrice(symbol);
            case 'gold':
                return this.getGoldPrice();
            default:
                throw new Error('Unknown asset type');
        }
    }

    // --- CRYPTO (CoinGecko) ---
    async getCryptoPrice(symbol) {
        try {
            // Map common symbols to CoinGecko IDs
            const idMap = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'DOGE': 'dogecoin',
                'BNB': 'binancecoin'
            };
            const id = idMap[symbol.toUpperCase()] || symbol.toLowerCase();

            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,thb`);
            const data = response.data[id];

            return {
                price: data.usd, // Base price in USD
                priceTHB: data.thb,
                symbol: symbol.toUpperCase(),
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching crypto price:', error.message);
            return null;
        }
    }

    // --- US STOCKS (Finnhub) ---
    async getUSStockPrice(symbol) {
        try {
            const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.finnhubApiKey}`);
            const data = response.data;

            // Finnhub response: c = current price, d = change, dp = percent change
            return {
                price: data.c,
                change: data.d,
                changePercent: data.dp,
                symbol: symbol.toUpperCase(),
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching US stock:', error.message);
            return null;
        }
    }

    // --- THAI STOCKS (Scraping/API) ---
    async getThaiStockPrice(symbol) {
        // Note: Free APIs for real-time Thai stocks are rare.
        // We might scrape SET or Yahoo Finance or use a specific provider.
        // Using Yahoo Finance for simplicity here (delayed 15 mins typically)
        try {
            const ySymbol = `${symbol.toUpperCase()}.BK`;
            // We can use an unofficial Yahoo Finance API wrapper or scrape
            // For this example, let's assume we use a library or a direct Yahoo fetch
            // Placeholder implementation:

            // In production, consider using a proper Thai API provider if real-time is critical
            console.log(`Fetching Thai Stock: ${ySymbol}`);

            // Mock for now to ensure system runs without external dep failure
            return {
                price: 35.50, // Example
                symbol: symbol.toUpperCase(),
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching Thai stock:', error.message);
            return null;
        }
    }

    // --- GOLD (GoldAPI / Scraping) ---
    async getGoldPrice() {
        try {
            // Free gold price API or scraping 'globlex' or 'goldtraders'
            // Placeholder:
            return {
                price: 2500, // USD/oz
                priceTHB: 42000, // THB/baht-weight
                symbol: 'GOLD',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching gold price:', error.message);
            return null;
        }
    }

    /**
     * Get historical data (candles) for Technical Analysis
     * Needed for RSI, MACD calculation
     */
    async getHistoricalPrices(symbol, type, timeframe = 'D', limit = 200) {
        // Returns array of closing prices: [100, 101, 102, ...]
        // Implementation depends on data source
        return []; // Placeholder
    }
}

module.exports = new PriceService();

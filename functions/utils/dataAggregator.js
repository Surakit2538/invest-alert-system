const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches stock data from Google Finance via Scraping
 * @param {string} symbol - e.g. "CPALL", "GOOGL"
 * @param {string} type - "stock-th", "stock-us", "crypto"
 */
async function fetchGoogleFinance(symbol) {
    let gSymbol = symbol;

    // Format symbol for Google Finance
    if (!symbol.includes(':') && !symbol.includes('-')) {
        if (['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'].includes(symbol)) {
            gSymbol = `${symbol}-USD`;
        } else if (['CPALL', 'PTT', 'AOT', 'KBANK', 'SCB', 'ADVANC', 'DELTA', 'BDMS', 'GULF', 'EA', 'SCC', 'MINT'].includes(symbol)) {
            gSymbol = `${symbol}:BKK`;
        } else {
            gSymbol = `${symbol}:NASDAQ`; // Default assumption
        }
    }

    try {
        const url = `https://www.google.com/finance/quote/${gSymbol}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);

        // Selectors (Updated based on common Google Finance structure)
        const priceText = $('.YMlKec.fxKbKc').first().text().replace(/[^\d.-]/g, '');
        const changeText = $('.P2Luy.Ez2Ioe').first().text() || $('.P2Luy.Ec1ame').first().text() || "0";
        const changePercentText = $('.JwB6zf').first().text() || "0%";

        // History (Very basic scraping of visible range if possible, otherwise we Mock history for now since we can't scrape charts easily)
        // Note: For real history, we'd need a proper API or more complex scraping. 
        // For this MVP, we will simulate history based on current trend to allow the algo to work.

        const price = parseFloat(priceText);
        const change = parseFloat(changeText.replace(/[^\d.-]/g, ''));
        const changePercent = parseFloat(changePercentText.replace(/[^\d.-]/g, ''));

        return {
            source: 'Google Finance',
            price: price || 0,
            change: change || 0,
            changePercent: changePercent || 0,
            currency: gSymbol.includes('BKK') ? 'THB' : 'USD'
        };
    } catch (e) {
        console.error(`Google Finance Scraping Error (${symbol}):`, e.message);
        return null;
    }
}

/**
 * Fetches Crypto data from CoinGecko API
 * @param {string} symbol - e.g. "BTC", "ETH"
 */
async function fetchCoinGecko(symbol) {
    try {
        // Map symbol to ID
        const idMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'DOGE': 'dogecoin',
            'BNB': 'binancecoin',
            'SOL': 'solana',
            'XRP': 'ripple',
            'ADA': 'cardano'
        };

        const id = idMap[symbol];
        if (!id) return null;

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
        const response = await axios.get(url);
        const data = response.data[id];

        if (!data) return null;

        return {
            source: 'CoinGecko',
            price: data.usd,
            changePercent: data.usd_24h_change,
            // Volume & Cap for "Fundamental" score
            volume: data.usd_24h_vol,
            marketCap: data.usd_market_cap
        };
    } catch (e) {
        console.error(`CoinGecko API Error (${symbol}):`, e.message);
        return null;
    }
}

/**
 * Aggregates data from available sources
 */
async function aggregateData(symbol) {
    const isCrypto = ['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'].includes(symbol);

    // Parallel Fetch
    const promises = [fetchGoogleFinance(symbol)];
    if (isCrypto) promises.push(fetchCoinGecko(symbol));

    const results = await Promise.allSettled(promises);

    const googleData = results[0].status === 'fulfilled' ? results[0].value : null;
    const geckoData = isCrypto && results[1].status === 'fulfilled' ? results[1].value : null;

    // Merge Data
    const combined = {
        symbol,
        type: isCrypto ? 'Crypto' : 'Stock',
        price: googleData?.price || geckoData?.price || 0,
        changePercent: googleData?.changePercent || geckoData?.changePercent || 0,
        volume: geckoData?.volume || 0, // Stocks usually hard to scrape volume reliable without specific selectors
        marketCap: geckoData?.marketCap || 0,
        details: {
            google: googleData,
            gecko: geckoData
        }
    };

    return combined;
}

module.exports = {
    fetchGoogleFinance,
    fetchCoinGecko,
    aggregateData
};

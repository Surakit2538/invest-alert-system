const pkg = require('yahoo-finance2');
let yahooFinance;
// Robust initialization
if (pkg.default) {
    if (typeof pkg.default === 'function') {
        try { yahooFinance = new pkg.default(); } catch (e) { yahooFinance = pkg.default; }
    } else { yahooFinance = pkg.default; }
} else {
    if (typeof pkg === 'function') {
        try { yahooFinance = new pkg(); } catch (e) { yahooFinance = pkg; }
    } else { yahooFinance = pkg; }
}
if (yahooFinance && typeof yahooFinance.suppressNotices === 'function') {
    yahooFinance.suppressNotices(['yahooSurvey', 'nonsensical']);
}

/**
 * Fetches stock/crypto data from Yahoo Finance (API)
 * @param {string} symbol - e.g. "CPALL", "GOOGL", "BTC"
 */
async function fetchStockPrice(symbol) {
    let ySymbol = symbol;

    // Symbol Normalization
    if (['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'].includes(symbol)) {
        ySymbol = `${symbol}-USD`;
    } else if (!symbol.includes('.') && !['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC', 'BABA', 'JD', 'BIDU'].includes(symbol)) {
        // Assume Thai Stock (SET) if not US Big Tech
        // Note: BABA is US (NYSE), so coverage added above
        ySymbol = `${symbol}.BK`;
    }

    try {
        const quote = await yahooFinance.quote(ySymbol);
        if (!quote) throw new Error("Quote not found");

        return {
            source: 'Yahoo Finance',
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            currency: quote.currency || 'USD'
        };
    } catch (e) {
        console.error(`Yahoo Finance Error (${ySymbol}):`, e.message);
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
// ... (fetchCoinGecko function remains but unused by default now)

/**
 * Aggregates data (now simplified to use Yahoo Finance for everything)
 */
async function aggregateData(symbol) {
    // Yahoo Finance handles both Stocks and Crypto
    // So we just use fetchStockPrice for everything
    const data = await fetchStockPrice(symbol);

    if (!data) return { symbol, price: 0, changePercent: 0, type: 'Unknown' };

    return {
        symbol,
        type: data.currency === 'USD' && symbol.length <= 4 && !symbol.includes('.') ? 'Crypto/US' : 'Stock', // Rough heuristic
        price: data.price,
        changePercent: data.changePercent,
        volume: 0,
        marketCap: 0,
        details: { yahoo: data }
    };
}

module.exports = {
    fetchStockPrice, // Renamed from fetchGoogleFinance
    fetchCoinGecko,
    aggregateData
};

// ---------------------------------------------------------
// FIREBASE CONFIGURATION
// ---------------------------------------------------------
// ⚠️ REPLACE WITH YOUR FIREBASE CONFIG FROM CONSOLE
// Go to Project Settings > General > Is your app not having a nickname? (Scroll down) > Add Web App
const firebaseConfig = {
    apiKey: "AIzaSyCjn54iA6saXD9r9e1gjTMUO7NpB9_-5tQ",
    authDomain: "invest-alert-game.firebaseapp.com",
    projectId: "invest-alert-game",
    storageBucket: "invest-alert-game.firebasestorage.app",
    messagingSenderId: "669180408069",
    appId: "1:669180408069:web:1130146ef29fd997f2476c",
    measurementId: "G-TF0DSFNRXP"
};

// Initialize Firebase
let db;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase Initialized");
    } else {
        console.error("Firebase SDK not loaded");
    }
} catch (e) {
    console.error("Firebase Init Error (Check Config):", e);
}

// Global State
let watchlistData = [];
const USER_ID = 'demo-user-001'; // Simulating a user for now

document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initialized');
    // If Firebase loaded, load data
    if (db) {
        loadWatchlist();
    } else {
        // Fallback or wait
        console.warn("Database not ready");
        document.getElementById('watchlistContainer').innerHTML = '<div style="color:red;padding:20px;">Firebase Config Required in app.js</div>';
    }

    setupEventListeners();


    simulateClick('dashboard');
});

function simulateClick(target) {
    const nav = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (nav) nav.click();
}

// ---------------------------------------------------------
// FIRESTORE FUNCTIONS
// ---------------------------------------------------------

async function loadWatchlist() {
    if (!db) return;
    const container = document.getElementById('watchlistContainer');
    container.innerHTML = '<div style="color:white;text-align:center;padding:20px;">Loading...</div>';

    try {
        const snapshot = await db.collection('users').doc(USER_ID).collection('watchlist').orderBy('createdAt', 'desc').get();
        watchlistData = [];
        snapshot.forEach(doc => {
            watchlistData.push({ id: doc.id, ...doc.data() });
        });

        renderWatchlist();
        updateCryptoPrices(); // Fetch live prices for loaded assets
    } catch (e) {
        console.error("Error loading watchlist:", e);
        // If index error, might fail on sort. Retry without sort
        try {
            const snapshot2 = await db.collection('users').doc(USER_ID).collection('watchlist').get();
            watchlistData = [];
            snapshot2.forEach(doc => watchlistData.push({ id: doc.id, ...doc.data() }));
            renderWatchlist();
            updateCryptoPrices();
        } catch (e2) {
            container.innerHTML = '<div style="color:red;text-align:center;">Error loading. Check Console.</div>';
        }
    }
}

async function addAssetToDb(symbol, mode) {
    if (!db) return;
    try {
        const newItem = {
            symbol: symbol,
            mode: mode,
            price: '---', // Will be updated by live fetch
            change: '0.0%',
            isUp: true,
            status: 'WAIT',
            conf: '-',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        // Check duplicate
        const exists = watchlistData.find(i => i.symbol === symbol);
        if (exists) { alert('Asset already exists!'); return; }

        const docRef = await db.collection('users').doc(USER_ID).collection('watchlist').add(newItem);
        watchlistData.unshift({ id: docRef.id, ...newItem }); // Add to front
        renderWatchlist();
        updateCryptoPrices();
    } catch (e) {
        console.error("Error adding asset:", e);
        alert("Failed to save: " + e.message); // Show actual error
    }
}

async function deleteAssetFromDb(id) {
    if (!db) return;
    if (!confirm('Delete this asset?')) return;

    try {
        await db.collection('users').doc(USER_ID).collection('watchlist').doc(id).delete();
        watchlistData = watchlistData.filter(item => item.id !== id);
        renderWatchlist();
    } catch (e) {
        console.error("Error deleting asset:", e);
    }
}

// ---------------------------------------------------------
// RENDER FUNCTIONS
// ---------------------------------------------------------

function renderWatchlist() {
    const container = document.getElementById('watchlistContainer');
    if (!container) return;

    if (watchlistData.length === 0) {
        container.innerHTML = '<div style="color:#aaa;text-align:center;padding:20px;">No assets yet. Click "Add Asset" to start.</div>';
        return;
    }

    const html = watchlistData.map(asset => {
        // Dynamic Icon Logic
        let icon = 'fa-solid fa-chart-line';
        if (['BTC', 'ETH', 'DOGE'].includes(asset.symbol)) icon = 'fa-brands fa-bitcoin';
        if (['AAPL', 'TSLA', 'GOOGL'].includes(asset.symbol)) icon = 'fa-brands fa-apple';
        if (asset.symbol.includes('GOLD')) icon = 'fa-solid fa-coins';

        return `
        <div class="asset-card">
            <div class="delete-btn" onclick="event.stopPropagation(); deleteAssetFromDb('${asset.id}')" style="position:absolute; top:10px; right:10px; color:#ff4d4d; cursor:pointer; z-index:10;"><i class="fa-solid fa-xmark"></i></div>
            <div class="card-clickable" onclick="openChart('${asset.symbol}')" style="cursor:pointer;">
                <div class="asset-header">
                    <div class="asset-icon">
                        <i class="${icon}"></i>
                    </div>
                    <span class="mode-badge">${asset.mode}</span>
                </div>
                
                <div class="asset-info">
                    <span class="symbol" style="font-weight:700; display:block; margin-bottom:4px;">${asset.symbol}</span>
                    <div class="asset-price">${asset.price || '---'}</div>
                    <span class="asset-change ${asset.isUp ? 'up' : 'down'}">
                        ${asset.change || '0%'} <i class="fa-solid ${asset.isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
                    </span>
                </div>
                
                <div class="status-indicator status-${(asset.status || 'NEUTRAL').toLowerCase()}">
                    <div class="dot"></div>
                    <span>${asset.status || 'WAIT'} ${asset.conf && asset.conf !== '-' ? `(${asset.conf})` : ''}</span>
                </div>
            </div>
            
            <!-- Analysis Button -->
            <button class="btn-analyze" onclick="event.stopPropagation(); analyzeAsset('${asset.symbol}')" 
                style="width:100%; margin-top:10px; background:rgba(255,255,255,0.1); border:none; color:white; padding:5px; border-radius:6px; cursor:pointer; font-size:0.8rem;">
                <i class="fa-solid fa-chart-pie"></i> View Analysis
            </button>
        </div>
    `}).join('');

    container.innerHTML = html;

    // Also update Dashboard "Daily Digest" card dynamically
    updateDashboardDigest();
}

function updateDashboardDigest() {
    // Find top 2 interesting assets (BUY/SELL)
    const significantAssets = watchlistData.filter(a => a.status === 'BUY' || a.status === 'SELL').slice(0, 2);

    // Default fallback if no signals
    if (significantAssets.length === 0 && watchlistData.length > 0) {
        significantAssets.push(watchlistData[0]);
        if (watchlistData.length > 1) significantAssets.push(watchlistData[1]);
    }

    const digestTitle = document.querySelector('.digest-card h2');
    const digestDesc = document.querySelector('.digest-card p');
    const signalPreview = document.querySelector('.signal-preview');

    if (digestTitle && significantAssets.length > 0) {
        const count = significantAssets.length;
        digestTitle.innerText = `${count} Active Signal${count > 1 ? 's' : ''}`;
        digestDesc.innerText = `Opportunities detected in your watchlist.`;
    }

    if (signalPreview && significantAssets.length > 0) {
        signalPreview.innerHTML = significantAssets.map(asset => {
            // Re-use icon logic simple
            let icon = 'fa-solid fa-chart-line';
            if (['BTC', 'ETH', 'DOGE'].includes(asset.symbol)) icon = 'fa-brands fa-bitcoin';
            if (['AAPL', 'TSLA', 'GOOGL'].includes(asset.symbol)) icon = 'fa-brands fa-apple';

            const statusClass = asset.status === 'BUY' ? 'buy' : (asset.status === 'SELL' ? 'sell' : '');

            return `
            <div class="signal-item ${statusClass}">
                <i class="${icon}"></i>
                <span>${asset.symbol}</span>
                <span class="conf">${asset.conf || '-'}</span>
            </div>
            `;
        }).join('');
    }
}

// ---------------------------------------------------------
// LOGIC FUNCTIONS
// ---------------------------------------------------------

function getRecommendationFromChange(changePercent) {
    const absChange = Math.abs(changePercent);
    const isUp = changePercent >= 0;

    if (absChange >= 3.0) return { status: isUp ? 'BUY' : 'SELL', label: 'Strong' };
    if (absChange >= 1.5) return { status: isUp ? 'BUY' : 'SELL', label: '' }; // Clean display (Just BUY)
    return { status: 'NEUTRAL', label: '' };
}

window.openChart = function (symbol) {
    console.log('Opening chart for:', symbol);
    const chartNav = document.querySelector('.nav-item[data-target="chart"]');
    if (chartNav) updateNavigation(chartNav);

    // TradingView Symbol Formatting
    let tvSymbol = symbol;
    const crypto = ['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA', 'USDT'];
    const usStocks = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC'];

    // Check custom prefixes or defaults
    if (symbol.includes(':')) {
        tvSymbol = symbol;
    } else {
        if (crypto.includes(symbol)) {
            tvSymbol = `BINANCE:${symbol}USDT`;
        } else if (usStocks.includes(symbol)) {
            tvSymbol = `NASDAQ:${symbol}`;
        } else {
            // Default assumption: If not Crypto/US Tech, assumes Thai Stock (SET)
            tvSymbol = `BKK:${symbol}`;
        }
    }

    // Initialize Widget
    if (typeof TradingView !== 'undefined') {
        document.getElementById('tradingview_widget').innerHTML = ''; // Clear old
        new TradingView.widget({
            "autosize": true,
            "symbol": tvSymbol,
            "interval": "D",
            "timezone": "Asia/Bangkok",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "container_id": "tradingview_widget",
            "hide_side_toolbar": false,
            "studies": [
                "RSI@tv-basicstudies",
                "MACD@tv-basicstudies"
            ]
        });
    } else {
        console.error('TradingView library not loaded');
        document.getElementById('tradingview_widget').innerHTML = '<div style="color:white;text-align:center;padding:50px;">TradingView Library Error. Refresh Page.</div>';
    }
}

// New: Analysis Function
window.analyzeAsset = async function (symbol) {
    const modal = document.getElementById('analysisModal');
    const content = document.getElementById('analysisContent');
    const title = document.getElementById('analysisTitle');

    // Open Modal with Loading
    modal.classList.add('show');
    title.innerText = `Analyzing ${symbol}...`;
    content.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Intelligence Analyzing...</div>';

    try {
        // Call Backend Cloud Function
        const projectId = firebaseConfig.projectId;
        const region = 'asia-southeast1';
        const url = `https://${region}-${projectId}.cloudfunctions.net/analyzeAsset?symbol=${symbol}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Render Result
        renderAnalysisReport(data);

    } catch (e) {
        console.error("Analysis Error:", e);
        content.innerHTML = `<div style="color:red; text-align:center; padding:20px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Analysis Failed<br>${e.message}
        </div>`;
        title.innerText = 'Error';
    }
}

function renderAnalysisReport(data) {
    const title = document.getElementById('analysisTitle');
    const content = document.getElementById('analysisContent');

    title.innerText = `${data.symbol} Parallel Analysis`;

    // Determine Color based on recommendation
    let colorClass = 'neutral';
    if (data.recommendation.includes('BUY')) colorClass = 'buy';
    if (data.recommendation.includes('SELL')) colorClass = 'sell';

    // Format Sources
    const sources = data.sources.join(', ');

    const html = `
        <div class="analysis-header">
            <div class="main-rec ${colorClass}">
                <span class="rec-label">${data.recommendation}</span>
                <span class="rec-score">Score: ${data.score}/100</span>
            </div>
            <div class="price-info">
                <h2>${data.currentPrice} <span class="currency">${data.currency}</span></h2>
                <span class="change-badge ${data.change24h.includes('-') ? 'down' : 'up'}">
                    ${data.change24h}
                </span>
            </div>
        </div>

        <div class="analysis-summary glass-card" style="margin: 15px 0; background: rgba(255,255,255,0.05);">
            <h3><i class="fa-solid fa-robot"></i> AI Executive Summary</h3>
            <p>${data.analysis.sentiment.summary || data.summary}</p>
        </div>

        <div class="analysis-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <!-- Stream 1: Technical -->
            <div class="metric-item">
                <label><i class="fa-solid fa-chart-line"></i> Technical</label>
                <div class="metric-val ${data.analysis.technical.rsi < 30 ? 'up' : (data.analysis.technical.rsi > 70 ? 'down' : 'neutral')}">
                    RSI: ${data.analysis.technical.rsi}
                </div>
                <small>${data.analysis.technical.signal} | MACD: ${data.analysis.technical.macd}</small>
            </div>

            <!-- Stream 2: Fundamental -->
            <div class="metric-item">
                <label><i class="fa-solid fa-building"></i> Fundamental</label>
                <div class="metric-val">
                    P/E: ${data.analysis.fundamental.pe}
                </div>
                <small>Vol: ${data.analysis.fundamental.volume}</small>
            </div>

            <!-- Stream 3: Sentiment -->
            <div class="metric-item">
                <label><i class="fa-solid fa-comments"></i> Sentiment</label>
                <div class="metric-val ${data.analysis.sentiment.status === 'Bullish' ? 'up' : (data.analysis.sentiment.status === 'Bearish' ? 'down' : 'neutral')}">
                    ${data.analysis.sentiment.score}/100
                </div>
                <small>${data.analysis.sentiment.status}</small>
            </div>
        </div>
        
        <div class="disclaimer">
            Sources: ${sources}<br>
            ${data.riskWarning}
        </div>
    `;

    content.innerHTML = html;
}

// Global modal closer for onclick events
window.closeModal = function (id) {
    document.getElementById(id).classList.remove('show');
}

function updateNavigation(selectedItem) {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    if (!selectedItem) return;

    navItems.forEach(nav => nav.classList.remove('active'));
    sections.forEach(sec => sec.classList.remove('active'));

    selectedItem.classList.add('active');
    const target = selectedItem.dataset.target;
    const targetSection = document.getElementById(`view-${target}`);

    if (targetSection) {
        targetSection.classList.add('active');
        const link = selectedItem.querySelector('a');
        if (link) pageTitle.textContent = link.innerText.trim();
    }
}

// ---------------------------------------------------------
// REAL-TIME DATA FUNCTIONS
// ---------------------------------------------------------

async function updateCryptoPrices() {
    try {
        console.log('Fetching Prices...');
        let changed = false;

        // 1. Real Crypto Data (CoinGecko)
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
            const data = await response.json();
            if (data.bitcoin) changed |= updateAssetDataInMemory('BTC', data.bitcoin.usd, data.bitcoin.usd_24h_change);
            if (data.ethereum) changed |= updateAssetDataInMemory('ETH', data.ethereum.usd, data.ethereum.usd_24h_change);
        } catch (e) { console.warn('CoinGecko Error:', e); }

        // 2. Real Stock Data via Cloud Function Proxy (Google Finance)
        const stockAssets = watchlistData.filter(a => !['BTC', 'ETH'].includes(a.symbol));

        for (const asset of stockAssets) {
            if (!asset.lastUpdate || (Date.now() - asset.lastUpdate > 60000)) {
                try {
                    const projectId = firebaseConfig.projectId;
                    const region = 'asia-southeast1';
                    const url = `https://${region}-${projectId}.cloudfunctions.net/getStockPrice?symbol=${asset.symbol}`;

                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.price) {
                        const currency = ['CPALL', 'PTT', 'AOT', 'KBANK', 'SCB', 'ADVANC'].includes(asset.symbol) ? '฿' : '$';
                        asset.price = currency + data.price.toLocaleString();
                        asset.change = data.change;

                        const changeVal = parseFloat(data.change.replace('%', '').replace('+', ''));
                        const isUp = changeVal >= 0;

                        asset.isUp = isUp;
                        // Standardized Recommendation Logic (Card)
                        const rec = getRecommendationFromChange(changeVal);
                        asset.status = rec.status; // BUY, SELL, NEUTRAL
                        asset.conf = rec.label;    // Strong, or empty

                        asset.lastUpdate = Date.now();
                        changed = true;
                    }
                } catch (e) {
                    console.warn(`Failed to fetch ${asset.symbol}:`, e);
                }
            }
        }

        if (changed) renderWatchlist();
    } catch (e) {
        console.error('Error fetching prices:', e);
    }
}

function updateAssetDataInMemory(symbol, price, changePercent) {
    let found = false;
    watchlistData.forEach(asset => {
        if (asset.symbol === symbol) {
            asset.price = '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const isUp = changePercent >= 0;
            asset.isUp = isUp;
            asset.change = (isUp ? '+' : '') + changePercent.toFixed(2) + '%';
            // Standardized Logic for Crypto too
            const rec = getRecommendationFromChange(changePercent);
            asset.status = rec.status;
            asset.conf = rec.label;
            found = true;
        }
    });
    return found;
}

// ---------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------

function setupEventListeners() {
    // Note in renderWatchlist below we added onclick events directly to HTML string
    // Only need Global listeners here

    const addBtn = document.getElementById('addAssetBtn');
    const navItems = document.querySelectorAll('.nav-item');

    // Add Asset Modal Logic
    if (addBtn) addBtn.addEventListener('click', () => {
        document.getElementById('addAssetModal').classList.add('show');
        setTimeout(() => document.getElementById('assetSymbol').focus(), 100);
    });



    // Navigation (Robust)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            console.log('Nav Clicked:', item.dataset.target); // Debug
            e.preventDefault();
            // Handle active class manually here too for immediate feedback
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            updateNavigation(item);
        });
    });

    // Asset Add Confirmation
    const confirmBtn = document.getElementById('confirmAddBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const input = document.getElementById('assetSymbol');
            const symbol = input.value.toUpperCase();
            if (!symbol) return;

            confirmBtn.innerText = 'Saving...';
            await addAssetToDb(symbol, 'Technical');

            confirmBtn.innerText = 'Add Asset';
            input.value = '';
            document.getElementById('addAssetModal').classList.remove('show');
        });
    }

    // Auto-refresh prices
    setInterval(updateCryptoPrices, 30000);
}

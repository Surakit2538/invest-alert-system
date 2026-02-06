// ---------------------------------------------------------
// FIREBASE CONFIGURATION
// ---------------------------------------------------------
// ⚠️ REPLACE WITH YOUR FIREBASE CONFIG FROM CONSOLE
// Go to Project Settings > General > Is your app not having a nickname? (Scroll down) > Add Web App
const firebaseConfig = {
    apiKey: "AIzaSyCjn54iA6saXD9r9e1gjTMUO7NpB9_-5tQ", // ⚠️ Paste API Key from Firebase Console
    authDomain: "invest-alert-game.firebaseapp.com",
    projectId: "invest-alert-game",
    storageBucket: "invest-alert-game.appspot.com",
    messagingSenderId: "669180408069",
    appId: "1:669180408069:web:1130146ef29fd997f2476c"
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
        alert("Failed to save asset");
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

            return `
            <div class="signal-item ${asset.status === 'BUY' ? 'buy' : 'sell'}">
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

window.openChart = function (symbol) {
    console.log('Opening chart for:', symbol);
    const chartNav = document.querySelector('.nav-item[data-target="chart"]');
    if (chartNav) updateNavigation(chartNav);
    setTimeout(() => initTradingView(symbol), 100);
}

function initTradingView(symbol) {
    if (typeof TradingView === 'undefined') {
        setTimeout(() => initTradingView(symbol), 500); // Retry if library loading
        return;
    }
    const container = document.getElementById('tradingview_Widget');
    if (!container) return;
    container.innerHTML = '';

    let fullSymbol = symbol;
    if (['PTT', 'KBANK', 'AOT', 'SCB'].includes(symbol)) {
        fullSymbol = `SET:${symbol}`;
    } else if (['BTC', 'ETH', 'DOGE'].includes(symbol)) {
        fullSymbol = `BINANCE:${symbol}USDT`;
    } else {
        fullSymbol = `NASDAQ:${symbol}`;
    }

    new TradingView.widget({
        "autosize": true,
        "symbol": fullSymbol,
        "interval": "D",
        "timezone": "Asia/Bangkok",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "container_id": "tradingview_Widget",
        "hide_side_toolbar": false
    });
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
        if (target === 'chart') {
            const widgetContainer = document.getElementById('tradingview_Widget');
            if (widgetContainer && widgetContainer.innerHTML === '') {
                initTradingView('AAPL');
            }
        }
    }
}

// ---------------------------------------------------------
// REAL-TIME DATA FUNCTIONS
// ---------------------------------------------------------

async function updateCryptoPrices() {
    try {
        console.log('Fetching Crypto Prices...');
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
        const data = await response.json();

        // Update local data and re-render
        let changed = false;
        if (data.bitcoin) changed |= updateAssetDataInMemory('BTC', data.bitcoin.usd, data.bitcoin.usd_24h_change);
        if (data.ethereum) changed |= updateAssetDataInMemory('ETH', data.ethereum.usd, data.ethereum.usd_24h_change);

        if (changed) renderWatchlist();
    } catch (e) {
        console.error('Error fetching crypto:', e);
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
            if (Math.abs(changePercent) > 2) {
                asset.status = isUp ? 'BUY' : 'SELL';
                asset.conf = '80%';
            } else {
                asset.status = 'NEUTRAL';
            }
            found = true;
        }
    });
    return found;
}

// ---------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------

function setupEventListeners() {
    const modal = document.getElementById('addAssetModal');
    const addBtn = document.getElementById('addAssetBtn');
    const closeBtn = document.querySelector('.close-btn');
    const confirmBtn = document.getElementById('confirmAddBtn');
    const modeOptions = document.querySelectorAll('.mode-option');
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            updateNavigation(item);
        });
    });

    if (addBtn) addBtn.addEventListener('click', () => {
        modal.classList.add('show');
        setTimeout(() => document.getElementById('assetSymbol').focus(), 100);
    });

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const symbolInput = document.getElementById('assetSymbol');
            const symbol = symbolInput.value.toUpperCase();
            if (!symbol) return;

            const modeEl = document.querySelector('.mode-option.selected');
            const mode = modeEl ? modeEl.dataset.value : 'Technical';

            confirmBtn.innerText = 'Saving...';
            // Use DB function NOT push to array
            await addAssetToDb(symbol, mode);
            confirmBtn.innerText = 'Add Asset';

            symbolInput.value = '';
            modal.classList.remove('show');
        });
    }

    // Auto-refresh prices
    setInterval(updateCryptoPrices, 30000);
}

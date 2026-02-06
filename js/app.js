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

// ---------------------------------------------------------
// LOGIC FUNCTIONS
// ---------------------------------------------------------

window.openChart = function (symbol) {
    console.log('Opening chart for:', symbol);
    const chartNav = document.querySelector('.nav-item[data-target="chart"]');
    if (chartNav) updateNavigation(chartNav);

    // Update Google Finance Iframe
    const iframe = document.getElementById('google-finance-frame');
    if (iframe) {
        let gSymbol = symbol;
        const thaiStocks = ['PTT', 'KBANK', 'AOT', 'SCB', 'CPALL', 'ADVANC', 'DELTA', 'BDMS', 'GULF', 'EA', 'SCC', 'MINT'];
        const crypto = ['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'];

        if (thaiStocks.includes(symbol)) gSymbol = `${symbol}:BKK`;
        else if (crypto.includes(symbol)) gSymbol = `${symbol}-USD`;
        else gSymbol = `${symbol}:NASDAQ`;

        iframe.src = `https://www.google.com/finance/quote/${gSymbol}?window=6M`;
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

    title.innerText = `${data.symbol} Analysis Report`;

    // Determine Color based on recommendation
    let colorClass = 'neutral';
    if (data.recommendation === 'BUY') colorClass = 'buy';
    if (data.recommendation === 'SELL') colorClass = 'sell';

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
            <h3><i class="fa-solid fa-robot"></i> AI Summary</h3>
            <p>${data.summary}</p>
        </div>

        <div class="analysis-grid">
            <div class="metric-item">
                <label>Momentum</label>
                <div class="metric-val ${data.analysis.momentum.score === 'Positive' ? 'up' : 'down'}">
                    ${data.analysis.momentum.score}
                </div>
                <small>${data.analysis.momentum.reason}</small>
            </div>
            <div class="metric-item">
                <label>AI Sentiment</label>
                <div class="metric-val ${data.analysis.aiSentiment.score === 'Positive' ? 'up' : 'neutral'}">
                    ${data.analysis.aiSentiment.score}
                </div>
                <small>${data.analysis.aiSentiment.reason}</small>
            </div>
            <div class="metric-item">
                <label>Confidence</label>
                <div class="metric-val">${data.confidence}</div>
                <small>Based on ${data.sources.length} sources</small>
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
// REAL-TIME DATA FUNCTIONS (Existing)
// ---------------------------------------------------------
// ... (Keep existing updateCryptoPrices)

// ---------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------

function setupEventListeners() {
    // ... (Keep generic listeners) ...
    // Note in renderWatchlist below we added onclick events directly to HTML string
    // Only need Global listeners here

    const addBtn = document.getElementById('addAssetBtn');
    const navItems = document.querySelectorAll('.nav-item');

    // Add Asset Modal Logic
    if (addBtn) addBtn.addEventListener('click', () => {
        document.getElementById('addAssetModal').classList.add('show');
        setTimeout(() => document.getElementById('assetSymbol').focus(), 100);
    });

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
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


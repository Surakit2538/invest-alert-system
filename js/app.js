
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

    // Auto-update when clicking Watchlist menu
    const watchlistNav = document.querySelector('.nav-item[data-target="watchlist"]');
    if (watchlistNav) {
        watchlistNav.addEventListener('click', () => {
            console.log("Watchlist menu clicked. Triggering auto-update...");
            // Small delay to allow view switch
            setTimeout(() => window.autoUpdateWatchlist(), 500);
        });
    }

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
            const d = doc.data();
            console.log(`[Load] Loaded ${d.symbol}. Status: ${d.status}, Analyzed: ${d.analyzed}, LastAnalysis: ${d.lastAnalysis}`);
            watchlistData.push({ id: doc.id, ...d });
        });

        renderWatchlist();
        updateCryptoPrices(); // Fetch live prices for loaded assets
        // Auto-Update Analysis for all assets on load
        setTimeout(() => window.autoUpdateWatchlist(), 2000);
    } catch (e) {
        console.error("Error loading watchlist:", e);
        // If index error, might fail on sort. Retry without sort
        try {
            const snapshot2 = await db.collection('users').doc(USER_ID).collection('watchlist').get();
            watchlistData = [];
            snapshot2.forEach(doc => watchlistData.push({ id: doc.id, ...doc.data() }));
            renderWatchlist();
            updateCryptoPrices();
            setTimeout(() => window.autoUpdateWatchlist(), 2000);
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
            <div class="card-clickable" style="cursor:default;">
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



// New: Analysis Function
window.analyzeAsset = async function (symbol, silent = false) {
    const modal = document.getElementById('analysisModal');
    const content = document.getElementById('analysisContent');
    const title = document.getElementById('analysisTitle');

    // Open Modal only if NOT silent
    if (!silent) {
        modal.classList.add('show');
        title.innerText = `Analyzing ${symbol}...`;
        content.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Intelligence Analyzing...</div>';
    } else {
        // Show Loading Indicator on Card?
        // Maybe find the card and add a spinner
        const card = Array.from(document.querySelectorAll('.asset-card')).find(c => c.innerText.includes(symbol));
        if (card) {
            const statusHook = card.querySelector('.status-indicator span');
            if (statusHook) statusHook.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        }
    }

    try {
        // Call Backend Cloud Function
        const projectId = firebaseConfig.projectId;
        const region = 'asia-southeast1';
        const url = `https://${region}-${projectId}.cloudfunctions.net/analyzeAsset?symbol=${symbol}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Render Result if Modal is Open (and it matches current symbol? optional check)
        if (!silent) {
            renderAnalysisReport(data);
        }

        // UPDATE WATCHLIST CARD TO MATCH ANALYSIS
        // Find asset in local state
        const asset = watchlistData.find(a => a.symbol === symbol);

        console.log(`[Analysis] Fetched Data for ${symbol}: Status=${data.recommendation}, Score=${data.score}`);

        if (asset) {
            // Mark as Analyzed and Store Analysis Data for Persistence
            const now = Date.now();
            asset.analyzed = true;
            asset.lastAnalysis = now;
            asset.analysisData = {
                status: data.recommendation,
                conf: `Score: ${data.score}/100`,
                price: `${data.currentPrice} ${data.currency}`,
                change: data.change24h,
                isUp: !data.change24h.includes('-')
            };

            // Immediate Update (Force Overwrite)
            asset.status = asset.analysisData.status;
            asset.conf = asset.analysisData.conf;
            asset.price = asset.analysisData.price;
            asset.change = asset.analysisData.change;
            asset.isUp = asset.analysisData.isUp;

            // PERSIST TO FIRESTORE (Watchlist Update)
            if (db && USER_ID && asset.id) {
                db.collection('users').doc(USER_ID).collection('watchlist').doc(asset.id).update({
                    status: asset.status,
                    conf: asset.conf,
                    price: asset.price,
                    change: asset.change,
                    isUp: asset.isUp,
                    lastAnalysis: now,
                    analysisData: asset.analysisData
                }).catch(err => console.error(`[Analysis] Watchlist Update failed:`, err));

                // BACKTESTING: Save Snapshot (Only if data changed significantly? No, save all for now)
                if (!silent || (Math.random() < 0.1)) { // Optimization: Don't save snapshot EVERY auto-load? 
                    // User requested "Every time enter website". So yes, save snapshot.
                    // But if user refreshes 10 times, we get 10 snapshots.
                    // Maybe check lastAnalysis time?
                    // Let's save it. Valid for backtesting.
                    db.collection('users').doc(USER_ID).collection('analysis_history').add({
                        symbol: asset.symbol,
                        timestamp: now,
                        recommendation: data.recommendation,
                        score: data.score,
                        fundamentalScore: data.analysis?.fundamental?.score || 0,
                        priceAtAnalysis: data.priceValue || parseFloat(data.currentPrice.replace(/[^0-9.]/g, '')),
                        currency: data.currency,
                        status: 'active',
                        outcome: 'pending'
                    }).catch(err => console.error(`[Backtest] Save failed:`, err));
                }
            }

            // Re-render watchlist to show updated data
            renderWatchlist();
        }

    } catch (e) {
        console.error(`Analysis Error (${symbol}):`, e);
        if (!silent) {
            content.innerHTML = `<div style="color:red; text-align:center; padding:20px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Analysis Failed<br>${e.message}
            </div>`;
            title.innerText = 'Error';
        }
    }
}

// Auto-Update All Assets
window.autoUpdateWatchlist = async function () {
    console.log("Starting Auto-Update for Watchlist...");
    const symbols = watchlistData.map(a => a.symbol);

    // Process sequentially to avoid rate limits
    for (const symbol of symbols) {
        await window.analyzeAsset(symbol, true); // Silent mode
        // Small delay
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Auto-Update Complete.");
}

// End of analyzeAsset refactoring

function renderAnalysisReport(data) {
    const title = document.getElementById('analysisTitle');
    const content = document.getElementById('analysisContent');

    title.innerText = `${data.symbol} Parallel Analysis`;

    // Determine Color based on recommendation
    const rec = data.recommendation || 'NEUTRAL';
    let colorClass = 'neutral';
    if (rec.includes('BUY')) colorClass = 'buy';
    else if (rec.includes('SELL')) colorClass = 'sell';
    else if (rec.includes('HOLD')) colorClass = 'hold';

    // Format Sources
    const sources = (data.sources || []).join(', ');
    const changeText = data.change24h || '0%';
    const isDown = changeText.includes('-');

    const html = `
        <div class="analysis-header">
            <div class="main-rec ${colorClass}">
                <span class="rec-label">${rec}</span>
                <span class="rec-score">Score: ${data.score || 0}/100</span>
            </div>
            <div class="price-info">
                <h2>${data.currentPrice || '---'} <span class="currency">${data.currency || ''}</span></h2>
                <span class="change-badge ${isDown ? 'down' : 'up'}">
                    ${changeText}
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
                <div class="metric-val ${data.analysis.fundamental.score >= 70 ? 'up' : 'neutral'}">
                    Score: ${data.analysis.fundamental.score || 0}
                </div>
                <div style="font-size: 0.75rem; text-align: left; margin-top: 5px; line-height: 1.4;">
                    <div>P/E: ${data.analysis.fundamental.pe}</div>
                    <div>Yield: ${data.analysis.fundamental.dividendYield || '-'}</div>
                    <div style="color: #aaa;">Growth: ${data.analysis.fundamental.revenueGrowth || '-'}</div>
                </div>
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
        
        <div style="text-align: center; margin-top: 10px; font-size: 0.8rem; opacity: 0.7;">
            Strategy: ${data.analysis.fundamental.pe === 'N/A' && data.analysis.fundamental.dividendYield === '0.00%' ? 'Crypto (20% Fund / 40% Tech)' : 'Stock (40% Fund / 30% Tech)'}
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

// Feature: Backtest Accuracy Check
window.checkBacktestAccuracy = async function () {
    const modal = document.getElementById('analysisModal');
    const title = document.getElementById('analysisTitle');
    const content = document.getElementById('analysisContent');

    modal.classList.add('show');
    title.innerText = 'Backtest Accuracy Report';
    content.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Checking Historical Performance...</div>';

    try {
        // Get Project ID from firebase config (assuming it's available globally or we parse it)
        // Since firebaseConfig is usually defined in index.html or app.js
        // Let's assume the URL pattern or try to construct it.
        // If firebaseConfig is not available, we use hardcoded or fetch from somewhere.
        // In this project, firebaseConfig is likely in index.html script block or app.js top.
        // For now, let's use the one from `firebaseConfig` object if it exists.

        const projectId = (typeof firebaseConfig !== 'undefined') ? firebaseConfig.projectId : 'invest-alert-game';
        const region = 'asia-southeast1';
        const url = `https://${region}-${projectId}.cloudfunctions.net/checkBacktestAccuracy?userId=${USER_ID}`;

        console.log("Fetching Check Accuracy:", url);
        const res = await fetch(url);
        const data = await res.json();
        // ... (rest of logic)

        if (data.error) throw new Error(data.error);

        if (!data.results || data.results.length === 0) {
            content.innerHTML = `<div style="text-align:center; padding:20px;">No active analysis history found to check. Start analyzing assets to build history!</div>`;
            return;
        }

        let html = `<div style="text-align:center; margin-bottom:15px;">Updated ${data.updated} records.</div>`;
        html += `<table style="width:100%; text-align:left; border-collapse: collapse;">
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="padding:8px;">Symbol</th>
                <th style="padding:8px;">Return</th>
                <th style="padding:8px;">Status</th>
            </tr>`;

        data.results.forEach(r => {
            const color = r.isProfitable ? '#10b981' : '#ef4444';
            const icon = r.isProfitable ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:8px;">${r.symbol}</td>
                    <td style="padding:8px; color:${color}; font-weight:bold;">${r.return}</td>
                    <td style="padding:8px; color:${color};">${icon}</td>
                </tr>
             `;
        });
        html += `</table>`;

        content.innerHTML = html;

    } catch (e) {
        console.error("Backtest Check Failed:", e);
        content.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`;
    }
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

        // Unified Fetch via Backend Proxy (Solves CORS)
        for (const asset of watchlistData) {
            // Check if update needed (e.g. > 1 min ago)
            if (!asset.lastUpdate || (Date.now() - asset.lastUpdate > 60000)) {
                try {
                    const projectId = firebaseConfig.projectId;
                    const region = 'asia-southeast1';

                    // Handle Symbol Normalization for Yahoo Finance backend
                    let querySymbol = asset.symbol;
                    if (['BTC', 'ETH', 'DOGE', 'BNB', 'SOL', 'XRP', 'ADA'].includes(asset.symbol)) {
                        querySymbol = `${asset.symbol}-USD`;
                    } else if (!asset.symbol.includes('.') && !['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC'].includes(asset.symbol)) {
                        // Thai stocks likely need .BK if not already
                        querySymbol = `${asset.symbol}.BK`;
                    }

                    const url = `https://${region}-${projectId}.cloudfunctions.net/getStockPrice?symbol=${querySymbol}`;

                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.price) {
                        changed |= updateAssetDataInMemory(asset.symbol, data.price, parseFloat(data.change.replace('%', '').replace('+', '')));
                        asset.lastUpdate = Date.now();
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
            // 1. Always update live price first (Background update)
            asset.price = '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const isUp = changePercent >= 0;
            asset.isUp = isUp;
            asset.change = (isUp ? '+' : '') + changePercent.toFixed(2) + '%';

            // 2. BUT if Analyzed Recently, OVERWRITE with Analysis Snapshot to ensure consistency
            if (asset.analyzed && asset.analysisData && (Date.now() - (asset.lastAnalysis || 0) < 3600000)) {
                console.log(`[Update] Maintaining Analysis Data for ${symbol} (Analyzed recently). Status: ${asset.analysisData.status}`);
                // Force sync with Analysis Report
                asset.status = asset.analysisData.status;
                asset.conf = asset.analysisData.conf;
                asset.price = asset.analysisData.price;
                asset.change = asset.analysisData.change;
                asset.isUp = asset.analysisData.isUp;
            } else {
                // Standard Protocol
                const rec = getRecommendationFromChange(changePercent);
                asset.status = rec.status;
                asset.conf = rec.label;
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

// Mock Data with TradingView integration
let mockWatchlist = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: '185.92',
        change: '+1.25%',
        isUp: true,
        mode: 'Technical',
        status: 'BUY',
        conf: '85%',
        icon: 'fa-brands fa-apple'
    },
    {
        symbol: 'BTC',
        name: 'Bitcoin',
        price: '$52,030',
        change: '+3.4%',
        isUp: true,
        mode: 'Technical',
        status: 'BUY',
        conf: '82%',
        icon: 'fa-brands fa-bitcoin'
    },
    {
        symbol: 'TSLA',
        name: 'Tesla',
        price: '$190.10',
        change: '-2.1%',
        isUp: false,
        mode: 'Technical',
        status: 'SELL',
        conf: '88%',
        icon: 'fa-solid fa-car-bolt'
    },
    {
        symbol: 'PTT',
        name: 'PTT PCL',
        price: '34.50',
        change: '0.0%',
        isUp: true,
        mode: 'Price (<32)',
        status: 'NEUTRAL',
        conf: '-',
        icon: 'fa-solid fa-droplet'
    },
    {
        symbol: 'KBANK',
        name: 'Kasikornbank',
        price: '122.00',
        change: '-0.5%',
        isUp: false,
        mode: 'Both',
        status: 'NEUTRAL',
        conf: '-',
        icon: 'fa-solid fa-building-columns'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initialized');
    renderWatchlist();
    setupEventListeners();

    // Default load Dashboard (ensure first tab is active)
    simulateClick('dashboard');
});

function simulateClick(target) {
    const nav = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (nav) nav.click();
}

// ---------------------------------------------------------
// RENDER FUNCTIONS
// ---------------------------------------------------------

function renderWatchlist() {
    const container = document.getElementById('watchlistContainer');
    if (!container) return;

    const html = mockWatchlist.map(asset => `
        <div class="asset-card" onclick="openChart('${asset.symbol}')">
            <div class="asset-header">
                <div class="asset-icon">
                    <i class="${asset.icon}"></i>
                </div>
                <span class="mode-badge">${asset.mode}</span>
            </div>
            
            <div class="asset-info">
                <span class="symbol" style="font-weight:700; display:block; margin-bottom:4px;">${asset.symbol}</span>
                <div class="asset-price">${asset.price}</div>
                <span class="asset-change ${asset.isUp ? 'up' : 'down'}">
                    ${asset.change} <i class="fa-solid ${asset.isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
                </span>
            </div>
            
            <div class="status-indicator status-${asset.status.toLowerCase()}">
                <div class="dot"></div>
                <span>${asset.status} ${asset.conf !== '-' ? `(${asset.conf})` : ''}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// ---------------------------------------------------------
// LOGIC FUNCTIONS
// ---------------------------------------------------------

window.openChart = function (symbol) {
    console.log('Opening chart for:', symbol);

    // 1. Switch sidebar to chart
    const chartNav = document.querySelector('.nav-item[data-target="chart"]');
    if (chartNav) {
        // Manually trigger the click logic
        updateNavigation(chartNav);
    }

    // 2. Load symbol
    setTimeout(() => {
        initTradingView(symbol);
    }, 100);
}

function initTradingView(symbol) {
    if (typeof TradingView === 'undefined') {
        console.warn('TradingView library not loaded yet');
        return;
    }

    const container = document.getElementById('tradingview_Widget');
    if (!container) return;

    // Clear previous if any
    container.innerHTML = '';

    // Detect market for better symbol resolution
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

    // Remove active class
    navItems.forEach(nav => nav.classList.remove('active'));
    sections.forEach(sec => sec.classList.remove('active'));

    // Add active class
    selectedItem.classList.add('active');

    // Show Target Section
    const target = selectedItem.dataset.target;
    // Fix: ensure we select strictly by ID
    const targetSection = document.getElementById(`view-${target}`);

    if (targetSection) {
        targetSection.classList.add('active');

        // Update Title (Get text from link)
        const link = selectedItem.querySelector('a');
        if (link) pageTitle.textContent = link.innerText.trim();

        // Special case: Render Chart if chart tab selected
        if (target === 'chart') {
            // If no widget yet, init default
            const widgetContainer = document.getElementById('tradingview_Widget');
            if (widgetContainer && widgetContainer.innerHTML === '') {
                initTradingView('AAPL');
            }
        }
    }
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

    // --- Sidebar Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            updateNavigation(item);
        });
    });

    // --- Modal Logic ---
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            modal.classList.add('show');
            setTimeout(() => document.getElementById('assetSymbol').focus(), 100);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    // Mode Selection
    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    // Add Asset Action
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const symbolInput = document.getElementById('assetSymbol');
            const symbol = symbolInput.value.toUpperCase();
            if (!symbol) return;

            const modeEl = document.querySelector('.mode-option.selected');
            const mode = modeEl ? modeEl.dataset.value : 'Technical';

            const newItem = {
                symbol: symbol,
                name: symbol,
                price: '---',
                change: '0.0%',
                isUp: true,
                mode: mode,
                status: 'NEUTRAL',
                conf: '-',
                icon: 'fa-solid fa-chart-line'
            };

            mockWatchlist.push(newItem);
            renderWatchlist();

            symbolInput.value = '';
            modal.classList.remove('show');
        });
    }
}

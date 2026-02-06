# Investment Alert System

> Smart portfolio management with automated technical analysis and LINE notifications

![Dashboard Preview](https://img.shields.io/badge/Status-In%20Development-yellow)
![Tech Stack](https://img.shields.io/badge/Tech-Firebase%20%7C%20LINE%20%7C%20TradingView-blue)

## 🎯 Features

- 📊 **Technical Analysis** - RSI, MACD, Bollinger Bands, Moving Averages
- 🤖 **LINE Bot Integration** - Real-time alerts and commands
- 📈 **TradingView Charts** - Professional charting interface
- 🔔 **Daily Digest** - Smart notifications at 08:00 AM (only high-confidence signals)
- 📱 **Custom Watchlist** - Track your favorite assets
- 💼 **Multi-Asset Support** - Stocks (US/Thai), Crypto, Gold, Mutual Funds

## 🚀 Demo

**Live Dashboard:** [View Demo](https://your-username.github.io/invest-alert-system/)

## 📋 Tech Stack

- **Backend:** Firebase Cloud Functions (Node.js)
- **Bot:** LINE Messaging API
- **Frontend:** Vanilla JS + TradingView Widget
- **Analysis:** Technical Indicators Library
- **Database:** Firestore

## 🛠️ Local Development

```bash
# Install dependencies
cd functions
npm install

# Run local server
cd ..
npx http-server public -p 8080

# Test functions locally
cd functions
npm run serve
```

## 📦 Environment Variables

Create `functions/.env`:

```env
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
FINNHUB_API_KEY=optional_api_key
```

## 🔧 LINE Bot Commands

- `check [SYMBOL]` - Analyze stock/crypto
- `price [SYMBOL]` - Get current price
- `watchlist` - View your watchlist
- `help` - Show all commands

## 📄 License

MIT License - Feel free to use for personal projects

---

Built with ❤️ for smart investors

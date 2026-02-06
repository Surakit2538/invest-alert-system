const line = require('@line/bot-sdk');
const priceService = require('../services/priceService');
const indicatorService = require('../services/indicatorService');
const confidenceScorer = require('../services/confidenceScorer');

// Config will be set via key
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
    channelSecret: process.env.LINE_CHANNEL_SECRET || 'YOUR_CHANNEL_SECRET'
};

const client = new line.Client(config);

exports.handle = async (req, res) => {
    try {
        // Verify signature if needed (omitted for dev simplicity but recommended for prod)

        if (req.method !== 'POST') {
            res.status(200).send("Method Not Allowed");
            return;
        }

        const events = req.body.events;
        if (!events || events.length === 0) {
            res.status(200).send('OK');
            return;
        }

        // Process all events
        const results = await Promise.all(events.map(async (event) => {
            // Handle different event types
            if (event.type === 'message' && event.message.type === 'text') {
                return handleTextMessage(event);
            }
            return Promise.resolve(null);
        }));

        res.status(200).send(results);
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).end();
    }
};

async function handleTextMessage(event) {
    const text = event.message.text.trim();
    const userId = event.source.userId;

    // 1. Help Command
    if (text.toLowerCase() === 'help' || text === 'เมนู' || text === '?') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🤖 คำสั่งที่ใช้ได้:\n\n1. check [ชื่อหุ้น] - วิเคราะห์หุ้นทันที\n   Ex: check AAPL, check PTT\n\n2. price [ชื่อหุ้น] - ดูราคาปัจจุบัน\n   Ex: price BTC\n\n3. watchlist - ดูรายการที่ติดตาม\n\n4. help - ดูคำสั่งทั้งหมด`
        });
    }

    // 2. Check/Analyze Command (check AAPL)
    if (text.toLowerCase().startsWith('check ')) {
        const symbol = text.split(' ')[1].toUpperCase();
        return handleCheckCommand(event.replyToken, symbol);
    }

    // 3. Price Command (price BTC)
    if (text.toLowerCase().startsWith('price ')) {
        const symbol = text.split(' ')[1].toUpperCase();
        return handlePriceCommand(event.replyToken, symbol);
    }

    // 4. Default Greeting
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `สวัสดีครับ! พิมพ์ 'check PTT' เพื่อให้ผมวิเคราะห์กราฟให้ได้เลยครับ 📈`
    });
}

// --- Command Handlers ---

async function handlePriceCommand(replyToken, symbol) {
    // Determine type roughly
    let type = 'us-stock';
    if (symbol === 'BTC' || symbol === 'ETH') type = 'crypto';
    if (symbol.endsWith('THB') || ['PTT', 'KBANK', 'SCB', 'AOT'].includes(symbol)) {
        type = 'thai-stock';
    }

    // Attempt Fetch
    // Note: PriceService logic needs real API or will use Mock fallback we implement now
    const data = await priceService.getPrice(symbol, type);

    if (!data) {
        return client.replyMessage(replyToken, { type: 'text', text: `❌ ไม่พบข้อมูลราคาของ ${symbol}` });
    }

    return client.replyMessage(replyToken, {
        type: 'text',
        text: `💰 ราคา ${data.symbol} ล่าสุด:\n\nHigh: ${data.price}\n(API Actual/Mock Data)`
    });
}

async function handleCheckCommand(replyToken, symbol) {
    // This connects the whole pipeline: Price -> Indicators -> Confidence
    try {
        // 1. Get Price (Mock or Real)
        let type = 'us-stock';
        if (['BTC', 'ETH'].includes(symbol)) type = 'crypto';
        const priceData = await priceService.getPrice(symbol, type) || { price: 100, symbol }; // Fallback

        // 2. Get Historical (Using Mock Service for now as we don't have full DB)
        // In real app: await priceService.getHistoricalPrices(symbol, ...)
        // We will simulate data for demonstration
        const mockCloses = generateMockPrices(priceData.price);

        // 3. Calculate Indicators
        const indicators = indicatorService.calculateAll(mockCloses);

        // 4. Score Logic
        // Mock Fundamental
        const fundamental = { ROE: 10, DE: 1.5 };

        // Calculate Confidence
        const buyConf = confidenceScorer.calculateBuyConfidence({ price: priceData.price }, indicators, fundamental);
        const sellConf = confidenceScorer.calculateSellConfidence({ price: priceData.price }, indicators);

        let resultMsg = `📊 ผลการวิเคราะห์ ${symbol}\n`;
        resultMsg += `ราคา: ${priceData.price}\n\n`;

        if (buyConf.passed) {
            resultMsg += `🟢 แนะนำ: BUY (Grade ${buyConf.grade})\n`;
            resultMsg += `ความมั่นใจ: ${buyConf.confidence}%\n`;
            resultMsg += `เหตุผล:\n- ${Object.values(buyConf.breakdown).join('\n- ')}`;
        } else if (sellConf.passed) {
            resultMsg += `🔴 แนะนำ: SELL (Grade ${sellConf.grade})\n`;
            resultMsg += `ความมั่นใจ: ${sellConf.confidence}%\n`;
            resultMsg += `เหตุผล:\n- ${Object.values(sellConf.breakdown).join('\n- ')}`;
        } else {
            resultMsg += `🟡 แนะนำ: WAIT / HOLD\n`;
            resultMsg += `ยังไม่มีสัญญาณที่ชัดเจน (Buy Conf: ${buyConf.confidence}%)`;
        }

        return client.replyMessage(replyToken, {
            type: 'text',
            text: resultMsg
        });

    } catch (e) {
        console.error(e);
        return client.replyMessage(replyToken, { type: 'text', text: 'เกิดข้อผิดพลาดในการวิเคราะห์' });
    }
}

function generateMockPrices(current) {
    // Generate 200 random prices ending at current
    return Array.from({ length: 200 }, (_, i) => current * (1 + Math.sin(i / 10) * 0.1));
}

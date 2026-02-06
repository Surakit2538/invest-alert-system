/**
 * Investment Alert System - Main Entry Point
 * 
 * Functions:
 * 1. lineWebhook: Handles incoming messages from LINE OA
 * 2. sendDailyDigest: Scheduled task (08:00 AM) to send daily summary
 * 3. monitorPrices: Scheduled task (Every 15 mins) to check prices/indicators
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Set Global Options (Region)
setGlobalOptions({ region: 'asia-southeast1' });

// -- Load Handlers --
const lineWebhookHandler = require('./handlers/lineWebhook');
// const dailyDigestHandler = require('./handlers/dailyDigest');
// const priceMonitorHandler = require('./handlers/priceMonitor');

// -- LINE Webhook --
exports.lineWebhook = onRequest(async (req, res) => {
    await lineWebhookHandler.handle(req, res);
});

// -- Scheduled Tasks --

// 1. Daily Digest: every day at 08:00
exports.sendDailyDigest = onSchedule({
    schedule: '0 8 * * *',
    timeZone: 'Asia/Bangkok'
}, async (event) => {
    console.log('Running Daily Digest at 08:00 AM');
    // await dailyDigestHandler.execute();
});

// 2. Monitor Prices: Every 15 mins, 08:00 - 17:00, Mon-Fri
exports.monitorPrices = onSchedule({
    schedule: '*/15 8-17 * * 1-5',
    timeZone: 'Asia/Bangkok'
}, async (event) => {
    console.log('Running Price Monitor');
    // await priceMonitorHandler.execute();
});

// 3. Monitor Crypto (24/7) - Every hour
exports.monitorCrypto = onSchedule({
    schedule: '0 * * * *',
    timeZone: 'Asia/Bangkok'
}, async (event) => {
    console.log('Running Crypto Monitor');
    // await priceMonitorHandler.executeCrypto();
});

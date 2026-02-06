/**
 * Investment Alert System - Main Entry Point
 * 
 * Functions:
 * 1. lineWebhook: Handles incoming messages from LINE OA
 * 2. sendDailyDigest: Scheduled task (08:00 AM) to send daily summary
 * 3. monitorPrices: Scheduled task (Every 15 mins) to check prices/indicators
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// -- Load Handlers --
// เราจะสร้างไฟล์เหล่านี้ในขั้นตอนถัดไป
const lineWebhookHandler = require('./handlers/lineWebhook');
// const dailyDigestHandler = require('./handlers/dailyDigest');
// const priceMonitorHandler = require('./handlers/priceMonitor');

// -- LINE Webhook --
// https://ex-api.cloudfunctions.net/lineWebhook
exports.lineWebhook = functions
    .region('asia-southeast1')
    .https.onRequest(async (req, res) => {
        // Placeholder until handler is created
        // if (req.method === "POST") {
        //     console.log("Received LINE webhook event:", JSON.stringify(req.body));
        //     res.status(200).send("OK");
        // } else {
        //     res.status(200).send("Invest Alert System is Running!");
        // }
        await lineWebhookHandler.handle(req, res);
    });

// -- Scheduled Tasks --

// 1. Daily Digest: ส่งสรุปทุกเช้า 08:00 น.
exports.sendDailyDigest = functions
    .region('asia-southeast1')
    .pubsub
    .schedule('0 8 * * *') // Every day at 08:00
    .timeZone('Asia/Bangkok')
    .onRun(async (context) => {
        console.log('Running Daily Digest at 08:00 AM');
        // await dailyDigestHandler.execute();
        return null;
    });

// 2. Monitor Prices: ตรวจสอบราคาและ Indicators ทุก 15 นาที (08:00 - 17:00)
// เฉพาะวันจันทร์-ศุกร์ (ถ้าต้องการ monitor coin ตลอด 24/7 อาจต้องปรับ cron)
exports.monitorPrices = functions
    .region('asia-southeast1')
    .pubsub
    .schedule('*/15 8-17 * * 1-5') // Every 15 mins, 8AM-5PM, Mon-Fri
    .timeZone('Asia/Bangkok')
    .onRun(async (context) => {
        console.log('Running Price Monitor');
        // await priceMonitorHandler.execute();
        return null;
    });

// 3. Monitor Crypto (24/7) - ทุก 1 ชั่วโมง
exports.monitorCrypto = functions
    .region('asia-southeast1')
    .pubsub
    .schedule('0 * * * *') // Every hour
    .timeZone('Asia/Bangkok')
    .onRun(async (context) => {
        console.log('Running Crypto Monitor');
        // await priceMonitorHandler.executeCrypto();
        return null;
    });

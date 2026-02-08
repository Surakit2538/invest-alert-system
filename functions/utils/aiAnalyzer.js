const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// ⚠️ Environment Variable should be used in production
// For prototyping, we check if key is available, else return mock AI response
// FALLBACK: Hardcoded key from .env to ensure it works in this environment
const HARDCODED_KEY = "AIzaSyCdvN4kW2ev0_lD_gBIFB-st0fjlrgOuLc";
const API_KEY = process.env.GEMINI_API_KEY || HARDCODED_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Uses Gemini Analysis (Attempts 1.0 Pro -> Fallback to Flash)
 * @param {string} symbol
 * @param {object} marketData - The aggregated market data
 */
async function generateAIAnalysis(symbol, marketData) {
    const apiKey = API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
        console.warn("Gemini API Key missing. Returning mock analysis.");
        return getMockAIAnalysis(symbol, marketData, "Missing API Key");
    }

    // Shared Prompt
    const prompt = `
    You are a professional financial analyst. Analyze this asset: ${symbol}.
    
    Current Data:
    - Price: ${marketData.price}
    - 24h Change: ${marketData.changePercent}%
    - Type: ${marketData.type}
    
    Task:
    1. Sentiment Score (0-100) based on trend and momentum.
       - 0-39: Bearish (Negative)
       - 40-59: Neutral
       - 60-100: Bullish (Positive)
    2. Identify 2 key technical/fundamental reasons.
    3. Provide a clear summary (max 2 sentences) in THAI Language.
    
    Return JSON ONLY:
    {
      "score": 75,
      "status": "Bullish",
      "reasons": ["Reason 1", "Reason 2"],
      "summaryTH": "ภาษาไทย..."
    }
    `;

    try {
        // Attempt 1: Modern Gemini 2.5 Flash (2026 Standard)
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (e1) {
        console.error("AI Analysis Error (gemini-2.5-flash):", e1);

        // Attempt 2: Fallback to Gemini 2.5 Pro (Higher capacity/different availability?)
        try {
            console.log("Falling back to gemini-2.5-pro...");
            const modelFallback = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro" });
            const result = await modelFallback.generateContent(prompt);
            const responseText = result.response.text();
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);

        } catch (e2) {
            console.error("AI Analysis Error (Fallback):", e2);
            // Show full error chain
            return getMockAIAnalysis(symbol, marketData, `Gemini Error: ${e1.message} | Fallback: ${e2.message}`);
        }
    }
}

/**
 * Fallback Analysis if AI fails or No Key
 */
function getMockAIAnalysis(symbol, data, errorMessage = "") {
    const isUp = data.changePercent >= 0;
    const strength = Math.abs(data.changePercent);

    let score = 50;
    let status = "Neutral";

    if (isUp) {
        score = 50 + (strength * 5);
        if (score > 100) score = 95;
        if (score >= 60) status = "Bullish";
    } else {
        score = 50 - (strength * 5);
        if (score < 0) score = 5;
        if (score <= 39) status = "Bearish";
    }

    // Append error message to summary if present
    let summary = isUp
        ? `โมเมนตัมราคา ${symbol} กำลังปรับตัวขึ้นแข็งแกร่ง`
        : `ราคา ${symbol} มีการปรับฐานลง ควรระมัดระวัง`;

    if (errorMessage) {
        summary += ` (Mock Analysis - ${errorMessage})`;
    } else {
        summary += ` (Mock Analysis)`;
    }

    return {
        score: Math.round(score),
        status: status,
        reasons: [
            isUp ? "Strong short-term momentum" : "Selling pressure detected",
            `Price change of ${data.changePercent}% in 24h`
        ],
        summaryTH: summary
    };
}

module.exports = {
    generateAIAnalysis
};

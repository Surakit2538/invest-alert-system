const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ Environment Variable should be used in production
// For prototyping, we check if key is available, else return mock AI response
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Uses Gemini 2.0 Flash to analyze asset sentiment and generate reasoning
 * @param {string} symbol
 * @param {object} marketData - The aggregated market data
 */
async function generateAIAnalysis(symbol, marketData) {
    // Explicitly check for key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
        console.warn("Gemini API Key missing (Checked process.env). Returning mock analysis.");
        return getMockAIAnalysis(symbol, marketData);
    }

    // Re-initialize with correct key if needed (though global const might catch it, this is safer)
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
        You are a professional financial analyst. Analyze this asset: ${symbol}.
        
        Current Data:
        - Price: ${marketData.price}
        - 24h Change: ${marketData.changePercent}%
        - Type: ${marketData.type}
        
        Task:
        1. Determine sentiment (Positive/Neutral/Negative) based on the price trend.
        2. Identify 2 key technical reasons (e.g. momentum, psychological levels).
        3. Provide a clear summary (max 2 sentences) in THAI Language.
        
        Return JSON ONLY:
        {
          "sentiment": "Positive",
          "reasons": ["Reason 1", "Reason 2"],
          "summaryTH": "ภาษาไทย..."
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean markdown code blocks if present
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("AI Analysis Error:", e);
        return getMockAIAnalysis(symbol, marketData);
    }
}

/**
 * Fallback Analysis if AI fails or No Key
 */
function getMockAIAnalysis(symbol, data) {
    const isUp = data.changePercent >= 0;
    const strength = Math.abs(data.changePercent);

    let sentiment = "Neutral";
    if (strength > 1.5) sentiment = isUp ? "Positive" : "Negative";

    return {
        sentiment: sentiment,
        reasons: [
            isUp ? "Strong short-term momentum" : "Selling pressure detected",
            `Price change of ${data.changePercent}% in 24h`
        ],
        summaryTH: isUp
            ? `โมเมนตัมราคา ${symbol} กำลังปรับตัวขึ้นแข็งแกร่ง น่าจับตามอง`
            : `ราคา ${symbol} มีการปรับฐานลง ควรระมัดระวังแรงขายระยะสั้น`
    };
}

module.exports = {
    generateAIAnalysis
};

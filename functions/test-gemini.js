const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

console.log("Testing Key:", API_KEY ? (API_KEY.substring(0, 5) + "...") : "MISSING");

async function run() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error("List Models Failed:", res.status, res.statusText);
            const txt = await res.text();
            console.error(txt);
        } else {
            const data = await res.json();
            const models = data.models
                .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name);
            console.log("Compatible Models:", models);
            fs.writeFileSync('models.json', JSON.stringify(models, null, 2));
            console.log("Detailed models saved to models.json");
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
run();

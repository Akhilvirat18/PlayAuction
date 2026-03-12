const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent("Hello, respond with JSON: { \"status\": \"ok\" }");
        const response = await result.response;
        console.log("Response:", response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}

test();

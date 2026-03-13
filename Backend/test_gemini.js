require('dotenv').config({ path: 'c:/Projects/omnisync_2/Backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    const embedModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("embedContent"));
    
    fs.writeFileSync('c:/Projects/omnisync_2/Backend/models_list.txt', embedModels.map(m => m.name).join('\n'));
    console.log("Written to models_list.txt");
  } catch (e) {
    console.error(e);
  }
}

listModels();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config/index.js");

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY_ANALYSIS || config.GEMINI_API_KEY);
const analysisCache = new Map();

function getCacheKey(role, companySize) {
  return `${role.toLowerCase().trim()}|${companySize.toLowerCase().trim()}`;
}

async function analyzeRoleAndCompany(role, companySize) {
  const cacheKey = getCacheKey(role, companySize);
  
  if (analysisCache.has(cacheKey)) {
    console.log(`[promptAnalyzer] Cache hit for: ${role} | ${companySize}`);
    return analysisCache.get(cacheKey);
  }
  
  console.log(`[promptAnalyzer] Analyzing: ${role} | ${companySize}`);
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Analyze job role "${role}" and company size "${companySize}". Return JSON: {"roleDescription": "...", "companyDescription": "...", "attireStyle": "...", "environmentStyle": "...", "formalityLevel": "smart-casual", "companyContext": "..."}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "").trim();
    }
    
    const analyzed = JSON.parse(jsonText);
    
    if (!analyzed.roleDescription || !analyzed.companyDescription || !analyzed.attireStyle || !analyzed.environmentStyle) {
      throw new Error("Invalid analysis response");
    }
    
    analysisCache.set(cacheKey, analyzed);
    return analyzed;
  } catch (error) {
    console.error("[promptAnalyzer] Analysis failed:", error);
    return {
      roleDescription: `${role}; профессиональный специалист`,
      companyDescription: `Компания размером ${companySize}; современная организация`,
      attireStyle: "smart-casual, solid neutral colors, no large logos",
      environmentStyle: "modern professional office, neutral background",
      formalityLevel: "smart-casual",
      companyContext: "Современная динамичная организация",
    };
  }
}

function clearAnalysisCache() {
  analysisCache.clear();
  console.log("[promptAnalyzer] Cache cleared");
}

module.exports = {
  analyzeRoleAndCompany,
  clearAnalysisCache,
};

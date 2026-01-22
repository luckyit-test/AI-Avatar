/** 
 * Prompt Analyzer Service
 * Analyzes custom role and company size to generate appropriate prompts
 */
import { GoogleGenAI } from '@google/generative-ai';
import { GEMINI_API_KEY_ANALYSIS } from '../config/index.js';

const genAI = new GoogleGenAI({ apiKey });

// Cache for analysis results (in-memory, can be moved to DB later)
const analysisCache = new Map();

function getCacheKey(role, companySize) {
  return `${role.toLowerCase().trim()}|${companySize.toLowerCase().trim()}`;
}

export interface AnalyzedPromptData {
  roleDescription;
  companyDescription;
  attireStyle;
  environmentStyle;
  formalityLevel: 'formal' | 'business-casual' | 'casual' | 'smart-casual';
  companyContext;
}

export async function analyzeRoleAndCompany(
  role,
  companySize
): Promise<AnalyzedPromptData> {
  const cacheKey = getCacheKey(role, companySize);
  
  // Check cache first
  if (analysisCache.has(cacheKey)) {
    console.log(`[promptAnalyzer] Cache hit for: ${role} | ${companySize}`);
    return analysisCache.get(cacheKey);
  }

  console.log(`[promptAnalyzer] Analyzing: ${role} | ${companySize}`);

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a professional portrait photography consultant. Analyze the following job role and company size to determine appropriate styling for a professional business portrait.

Job Role: "${role}"
Company Size: "${companySize}"

Company Size Categories:
- "Стартап (до 15 чел)" - Startup (up to 15 employees)
- "Небольшая компания (16-100 чел)" - Small company (16-100 employees)
- "Средняя компания (101-250 чел)" - Medium company (101-250 employees)
- "Крупный бизнес (251+ чел)" - Large business (251+ employees)

Provide a JSON response with the following structure:
{
  "roleDescription": "Brief professional description of the role (2-3 sentences, in Russian)",
  "companyDescription": "Brief description of company context and culture based on size (2-3 sentences, in Russian)",
  "attireStyle": "Detailed attire description suitable for this role and company size (in Russian, e.g., 'smart-casual, solid neutral colors, cardigan or lightweight knit')",
  "environmentStyle": "Description of appropriate background/environment (in Russian, e.g., 'modern tech office, dynamic and energetic')",
  "formalityLevel": "one of, business-casual, casual, smart-casual",
  "companyContext": "Brief context about company culture and atmosphere (in Russian, 1-2 sentences)"
}

Return ONLY valid JSON, no additional text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extract JSON from response (might have markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const analyzed = JSON.parse(jsonText) as AnalyzedPromptData;

    // Validate required fields
    if (!analyzed.roleDescription || !analyzed.companyDescription || !analyzed.attireStyle || !analyzed.environmentStyle) {
      throw new Error('Invalid analysis response required fields');
    }

    // Cache the result
    analysisCache.set(cacheKey, analyzed);
    console.log(`[promptAnalyzer] Analysis complete and cached: ${role} | ${companySize}`);

    return analyzed;
  } catch (error) {
    console.error('[promptAnalyzer] Analysis failed:', error);
    // Return fallback data
    return {
      roleDescription: `${role}; профессиональный специалист`,
      companyDescription: `Компания размера ${companySize}; профессиональная среда`,
      attireStyle: 'smart-casual, solid neutral colors, no large logos',
      environmentStyle: 'modern professional office, neutral background',
      formalityLevel: 'smart-casual',
      companyContext: 'профессиональная корпоративная среда',
    };
  }
}

export function clearAnalysisCache() {
  analysisCache.clear();
  console.log('[promptAnalyzer] Cache cleared');
}

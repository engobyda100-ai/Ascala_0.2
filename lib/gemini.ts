import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Part,
} from '@google/generative-ai';
import { Persona, ScreenCapture, UXReport } from './types';
import { PERSONA_PROMPT, ANALYSIS_PROMPT } from './prompts';

function getGenAI() {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in your environment.'
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

/**
 * Generate a user persona from a target market description using Gemini.
 */
export async function generatePersona(targetMarket: string): Promise<Persona> {
  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
      safetySettings,
    });

    const prompt = PERSONA_PROMPT.replace('{{TARGET_MARKET}}', targetMarket);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return JSON.parse(text) as Persona;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API key') ||
      message.includes('GEMINI') ||
      message.includes('Gemini API key')
    ) {
      throw new Error(`Gemini API error: ${message}`);
    }

    if (message.includes('JSON')) {
      throw new Error(`Failed to parse persona JSON: ${message}`);
    }

    throw new Error(`Persona generation failed: ${message}`);
  }
}

/**
 * Analyze an app through a persona's lens using Gemini multimodal.
 */
export async function analyzeApp(
  persona: Persona,
  screens: ScreenCapture[]
): Promise<Omit<UXReport, 'persona' | 'screenshots'>> {
  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      safetySettings,
    });

    const extractedContent = screens
      .map(
        (s) =>
          `Page: ${s.pageTitle}\nURL: ${s.url}\nContent: ${s.extractedContent}`
      )
      .join('\n\n---\n\n');

    const prompt = ANALYSIS_PROMPT
      .replace('{{PERSONA_JSON}}', JSON.stringify(persona, null, 2))
      .replace('{{EXTRACTED_CONTENT}}', extractedContent);

    const parts: Part[] = [{ text: prompt }];

    for (const screen of screens) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: screen.screenshotBase64,
        },
      });
      parts.push({
        text: `[Screenshot of: ${screen.pageTitle} — ${screen.url}]`,
      });
    }

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return JSON.parse(text) as Omit<UXReport, 'persona' | 'screenshots'>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API key') ||
      message.includes('GEMINI') ||
      message.includes('Gemini API key')
    ) {
      throw new Error(`Gemini API error: ${message}`);
    }

    if (message.includes('JSON')) {
      throw new Error(`Failed to parse analysis JSON: ${message}`);
    }

    throw new Error(`App analysis failed: ${message}`);
  }
}
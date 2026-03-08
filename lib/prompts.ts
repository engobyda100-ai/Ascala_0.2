/**
 * PERSONA_PROMPT — Given a target market description, generates a Persona as JSON.
 * Expected output matches Persona interface.
 */
export const PERSONA_PROMPT = `You are a UX research expert. Given the following target market description, generate ONE detailed, realistic user persona.

TARGET MARKET:
{{TARGET_MARKET}}

Return a JSON object with exactly this structure:
{
  "name": "Full Name",
  "age": 34,
  "jobTitle": "Their job title",
  "companySize": "e.g. 10-50 employees",
  "goals": ["Goal 1", "Goal 2", "Goal 3"],
  "frustrations": ["Frustration 1", "Frustration 2", "Frustration 3"],
  "techSavviness": 3,
  "quote": "A sentence that captures their mindset",
  "signupTriggers": ["What would make them sign up"],
  "bounceTriggers": ["What would make them leave"]
}

Make the persona feel like a real person. Ground every attribute in the target market description. Be specific, not generic.`;

/**
 * ANALYSIS_PROMPT — Given a Persona JSON and extracted page content, plus screenshots,
 * analyzes the app and returns findings, metrics, recommendations, and persona verdict.
 * Expected output matches: UXFinding[], MetricPrediction[], Recommendation[], personaVerdict.
 * Finding categories: First Impression, Messaging Fit, Trust & Credibility, CTA Clarity, Friction Points, Missing Elements.
 */
export const ANALYSIS_PROMPT = `You are a UX analyst. You have been given a user persona and screenshots + content from a SaaS app. Your job is to review the app AS this persona — through their eyes, their goals, their frustrations, their tech level.

PERSONA:
{{PERSONA_JSON}}

EXTRACTED PAGE CONTENT:
{{EXTRACTED_CONTENT}}

The screenshots of each page are attached as images below.

Analyze the app and return a JSON object with this exact structure:
{
  "findings": [
    {
      "category": "First Impression",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    },
    {
      "category": "Messaging Fit",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    },
    {
      "category": "Trust & Credibility",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    },
    {
      "category": "CTA Clarity",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    },
    {
      "category": "Friction Points",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    },
    {
      "category": "Missing Elements",
      "findings": ["Finding 1", "Finding 2"],
      "severity": "Good" | "Needs Work" | "Critical"
    }
  ],
  "metrics": [
    {
      "metric": "Bounce Rate",
      "rating": "High" | "Medium" | "Low",
      "rationale": "One-line explanation"
    },
    {
      "metric": "Signup Conversion",
      "rating": "High" | "Medium" | "Low",
      "rationale": "One-line explanation"
    },
    {
      "metric": "Activation",
      "rating": "High" | "Medium" | "Low",
      "rationale": "One-line explanation"
    },
    {
      "metric": "Retention Risk",
      "rating": "High" | "Medium" | "Low",
      "rationale": "One-line explanation"
    },
    {
      "metric": "Referral Potential",
      "rating": "High" | "Medium" | "Low",
      "rationale": "One-line explanation"
    }
  ],
  "recommendations": [
    {
      "rank": 1,
      "whatToChange": "Specific change",
      "whyItMatters": "Why this persona cares",
      "expectedImpact": "Expected improvement"
    }
  ],
  "personaVerdict": "A 2-3 sentence first-person statement from the persona summarizing their overall reaction."
}

RULES:
- Stay in character as the persona for all opinions.
- Only comment on what you can actually SEE in the screenshots and extracted content.
- Do NOT invent features or content that isn't visible.
- Be honest but constructive.
- Be specific — reference actual text, buttons, or design elements you see.
- Include exactly the six finding categories above: First Impression, Messaging Fit, Trust & Credibility, CTA Clarity, Friction Points, Missing Elements.
- Provide top 3 recommendations, ranked by impact.`;

// types.ts

export interface Persona {
  name: string;
  age: number;
  jobTitle: string;
  companySize: string;
  goals: string[];
  frustrations: string[];
  techSavviness: number; // 1-5
  quote: string;
  signupTriggers: string[];
  bounceTriggers: string[];
}

export interface ScreenCapture {
  url: string;
  screenshotBase64: string;
  extractedContent: string;
  pageTitle: string;
  timestamp: number;
}

export interface MetricPrediction {
  metric: string;
  rating: 'High' | 'Medium' | 'Low';
  rationale: string;
}

export interface UXFinding {
  category: string;
  findings: string[];
  severity: 'Good' | 'Needs Work' | 'Critical';
}

export interface Recommendation {
  rank: number;
  whatToChange: string;
  whyItMatters: string;
  expectedImpact: string;
}

export interface UXReport {
  persona: Persona;
  screenshots: ScreenCapture[];
  findings: UXFinding[];
  metrics: MetricPrediction[];
  recommendations: Recommendation[];
  personaVerdict: string;
}

export interface ReviewRequest {
  targetMarket: string;
  appUrl: string;
}

import { NextRequest, NextResponse } from 'next/server';
import { generatePersona, analyzeApp } from '@/lib/gemini';
import { runBrowserSession } from '@/lib/browser';
import type { ReviewRequest, UXReport } from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body: ReviewRequest = await req.json();
    const {
      targetMarket,
      appUrl,
      selectedTestIds = [],
      intakeSummary,
      productContext,
      structuredIntake,
      attachedFiles = [],
    } = body;

    if (!targetMarket || !appUrl) {
      return NextResponse.json(
        { error: 'Both targetMarket and appUrl are required.' },
        { status: 400 }
      );
    }

    console.log('[1/3] Generating persona...');
    const persona = await generatePersona(targetMarket, {
      attachedFiles,
      intakeSummary,
      productContext,
      structuredIntake,
      selectedTestIds,
    });

    console.log('[2/3] Running browser session...');
    const browserSession = await runBrowserSession(appUrl, persona, {
      selectedTestIds,
      structuredIntake,
    });

    console.log('[3/3] Analyzing app through persona lens...');
    const analysis = await analyzeApp(persona, browserSession.screenshots, {
      attachedFiles,
      intakeSummary,
      productContext,
      browserExplorationSummary: browserSession.explorationSummary,
      structuredIntake,
      selectedTestIds,
    });

    const report: UXReport = {
      persona,
      screenshots: browserSession.screenshots,
      browserExplorationSummary: browserSession.explorationSummary,
      findings: analysis.findings,
      metrics: analysis.metrics,
      recommendations: analysis.recommendations,
      personaVerdict: analysis.personaVerdict,
      selectedTestResults: analysis.selectedTestResults,
    };

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Review pipeline failed:', error);
    return NextResponse.json(
      { error: `Review failed: ${message}` },
      { status: 500 }
    );
  }
}

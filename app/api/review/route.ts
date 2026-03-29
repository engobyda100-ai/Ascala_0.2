import { NextRequest, NextResponse } from 'next/server';
import { generatePersona, analyzeApp } from '@/lib/gemini';
import { runBrowserSession } from '@/lib/browser';
import type {
  BrowserExplorationSummary,
  InputMode,
  Persona,
  ReviewRequest,
  ScreenCapture,
  UXReport,
} from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body: ReviewRequest = await req.json();
    const {
      targetMarket,
      inputMode = 'url',
      appUrl,
      figmaUrl,
      screenshots = [],
      selectedTestIds = [],
      intakeSummary,
      productContext,
      structuredIntake,
      attachedFiles = [],
      selectedPersona,
    } = body;

    if (!targetMarket) {
      return NextResponse.json(
        { error: 'targetMarket is required.' },
        { status: 400 }
      );
    }

    const resolvedInputMode = normalizeInputMode(body.inputMode, body);

    if (resolvedInputMode === 'url' && !appUrl?.trim()) {
      return NextResponse.json(
        { error: 'appUrl is required for URL reviews.' },
        { status: 400 }
      );
    }

    if (resolvedInputMode === 'figma' && !figmaUrl?.trim() && !appUrl?.trim()) {
      return NextResponse.json(
        { error: 'figmaUrl is required for Figma reviews.' },
        { status: 400 }
      );
    }

    if (
      (resolvedInputMode === 'screenshots' || resolvedInputMode === 'video') &&
      screenshots.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            resolvedInputMode === 'video'
              ? 'At least one video-derived frame is required for video reviews.'
              : 'At least one screenshot is required for screenshot reviews.',
        },
        { status: 400 }
      );
    }

    let persona: Persona;

    if (selectedPersona) {
      persona = selectedPersona;
      console.log(`[1/3] Using selected persona: ${persona.name}...`);
    } else {
      console.log('[1/3] Generating persona...');
      persona = await generatePersona(targetMarket, {
        attachedFiles,
        inputMode: resolvedInputMode,
        intakeSummary,
        productContext,
        structuredIntake,
        selectedTestIds,
      });
    }

    const sourceUrl =
      resolvedInputMode === 'figma' ? figmaUrl?.trim() || appUrl?.trim() || '' : appUrl?.trim() || '';
    let normalizedScreenshots: ScreenCapture[] = [];
    let explorationSummary: BrowserExplorationSummary | undefined;
    let pipelineNotice: string | undefined;

    if (resolvedInputMode === 'screenshots' || resolvedInputMode === 'video') {
      console.log(
        resolvedInputMode === 'video'
          ? '[2/3] Normalizing provided video frames...'
          : '[2/3] Normalizing provided screenshots...'
      );
      normalizedScreenshots = normalizeProvidedScreenshots(screenshots);
      explorationSummary = buildStaticScreenshotSummary(
        normalizedScreenshots.length,
        resolvedInputMode
      );
    } else {
      console.log(
        resolvedInputMode === 'figma'
          ? '[2/3] Capturing Figma prototype screens...'
          : '[2/3] Running browser session...'
      );

      try {
        const browserSession = await runBrowserSession(sourceUrl, persona, {
          inputMode: resolvedInputMode,
          selectedTestIds,
          structuredIntake,
        });

        normalizedScreenshots = browserSession.screenshots;
        explorationSummary = browserSession.explorationSummary;
        pipelineNotice = browserSession.pipelineNotice;
      } catch (error) {
        throw error;
      }
    }

    console.log('[3/3] Analyzing app through persona lens...');
    const analysis = await analyzeApp(persona, normalizedScreenshots, {
      attachedFiles,
      inputMode: resolvedInputMode,
      intakeSummary,
      productContext,
      browserExplorationSummary: explorationSummary,
      structuredIntake,
      selectedTestIds,
    });

    const report: UXReport = {
      persona,
      screenshots: normalizedScreenshots,
      browserExplorationSummary: explorationSummary,
      pipelineNotice,
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

function normalizeInputMode(
  inputMode: InputMode | undefined,
  body: ReviewRequest
): InputMode {
  if (inputMode) {
    return inputMode;
  }

  if (body.screenshots?.length) {
    return 'screenshots';
  }

  if (body.figmaUrl?.trim()) {
    return 'figma';
  }

  return 'url';
}

function normalizeProvidedScreenshots(screenshots: string[]): ScreenCapture[] {
  return screenshots
    .map((value, index) => normalizeBase64Screenshot(value, index))
    .filter((screen): screen is ScreenCapture => Boolean(screen));
}

function normalizeBase64Screenshot(
  rawValue: string,
  index: number
): ScreenCapture | null {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return null;
  }

  const [, mimeType = 'image/png', base64 = trimmed] =
    trimmed.match(/^data:(image\/[\w.+-]+);base64,(.+)$/) || [];

  return {
    url: `screenshot://${index + 1}`,
    screenshotBase64: base64,
    extractedContent: `Step ${index + 1} of the screenshot flow. Static UI screenshot only. No live DOM extraction or browser navigation data was available. Infer likely user intent, clarity, friction, and next action from the visible interface.`,
    pageTitle: `Screenshot flow step ${index + 1}`,
    timestamp: Date.now() + index,
    captureLabel: `Step ${index + 1} · ${mimeType.replace('image/', '').toUpperCase()}`,
    observation:
      'Treat this as part of a user journey. Infer what the user sees, what they are trying to do, what is confusing, and what they would do next.',
  };
}

function buildStaticScreenshotSummary(
  count: number,
  inputMode: InputMode
): BrowserExplorationSummary {
  return {
    objectives: [],
    attempts: [],
    summary:
      inputMode === 'video'
        ? count > 1
          ? `Static video-frame flow review. ${count} frames were derived from uploaded videos and should be interpreted as a logical step-by-step user journey without live browser navigation.`
          : 'Static video-frame review only. One frame was derived from uploaded video, so treat it as a first-impression or landing experience without live browser navigation.'
        : count > 1
          ? `Static screenshot flow review. ${count} screenshots were provided directly and should be interpreted as a logical step-by-step user journey without live browser navigation.`
          : 'Static screenshot review only. One screenshot was provided directly, so treat it as a first-impression or landing experience without live browser navigation.',
  };
}

import Steel from 'steel-sdk';
import { chromium, type Browser, type Page } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  BrowserExplorationAttempt,
  BrowserExplorationObjective,
  BrowserExplorationSummary,
  BrowserSessionResult,
  FigmaLinkType,
  InputMode,
  Persona,
  ScreenCapture,
  StructuredIntakeContext,
  ValidationTestId,
} from './types';
import { VALIDATION_TEST_CATALOG } from './types';

interface BrowserSessionOptions {
  inputMode?: InputMode;
  selectedTestIds?: ValidationTestId[];
  structuredIntake?: StructuredIntakeContext;
}

interface ObjectivePlan extends BrowserExplorationObjective {
  observeInstruction: string;
  actionInstruction: string;
  extractInstruction: string;
}

const BROWSER_SESSION_MAX_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Gemini Vision helpers (replace Stagehand's act / observe / extract)
// ---------------------------------------------------------------------------

function getGeminiModel(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function screenshotAsBase64(page: Page): Promise<string> {
  const buffer = await page.screenshot();
  return buffer.toString('base64');
}

/**
 * AI-powered page action. Takes a screenshot, asks Gemini what Playwright
 * action to perform, then executes it. Falls back to a gentle scroll on any
 * failure (most act() calls in this codebase are scroll actions).
 */
async function geminiAct(
  page: Page,
  action: string,
  geminiApiKey: string,
): Promise<void> {
  try {
    const base64 = await screenshotAsBase64(page);
    const model = getGeminiModel(geminiApiKey);

    const result = await model.generateContent([
      {
        inlineData: { mimeType: 'image/png', data: base64 },
      },
      {
        text: `You are a browser automation assistant. Given the screenshot of the current page, determine the single best Playwright action to perform for this instruction:

"${action}"

Respond with ONLY a JSON object (no markdown, no code fences) in one of these formats:
- {"action":"scroll","x":0,"y":400}
- {"action":"click","x":<number>,"y":<number>}
- {"action":"type","x":<number>,"y":<number>,"text":"<string>"}

Where x,y are pixel coordinates relative to the viewport. Prefer scroll if the instruction mentions scrolling. If unsure, default to scroll.`,
      },
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.action === 'click') {
      await page.mouse.click(parsed.x, parsed.y);
    } else if (parsed.action === 'type') {
      await page.mouse.click(parsed.x, parsed.y);
      await page.keyboard.type(parsed.text || '');
    } else {
      await page.evaluate(
        ({ x, y }) => window.scrollBy(x, y),
        { x: parsed.x ?? 0, y: parsed.y ?? 400 },
      );
    }
  } catch {
    // Safe fallback: gentle scroll down
    await page.evaluate(() => window.scrollBy(0, 400));
  }
}

/**
 * AI-powered element observation. Takes a screenshot, asks Gemini to identify
 * UI elements matching a natural-language instruction. Returns an array of
 * candidate descriptions (empty array if none found).
 */
async function geminiObserve(
  page: Page,
  instruction: string,
  geminiApiKey: string,
): Promise<{ description: string }[]> {
  try {
    const base64 = await screenshotAsBase64(page);
    const model = getGeminiModel(geminiApiKey);

    const result = await model.generateContent([
      {
        inlineData: { mimeType: 'image/png', data: base64 },
      },
      {
        text: `You are a UI analysis assistant. Given the screenshot, identify all visible UI elements that match this instruction:

"${instruction}"

Respond with ONLY a JSON array (no markdown, no code fences) of objects:
[{"description":"<what the element is and where it appears>"}]

If no matching elements are found, respond with an empty array: []`,
      },
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

/**
 * AI-powered content extraction. Takes a screenshot (or reuses one), asks
 * Gemini to extract structured text content per the instruction.
 */
async function geminiExtract(
  page: Page,
  instruction: string,
  geminiApiKey: string,
  existingScreenshotBase64?: string,
): Promise<string> {
  try {
    const base64 = existingScreenshotBase64 || await screenshotAsBase64(page);
    const model = getGeminiModel(geminiApiKey);

    const result = await model.generateContent([
      {
        inlineData: { mimeType: 'image/png', data: base64 },
      },
      {
        text: `You are a content extraction assistant. Given the screenshot, extract the following:

"${instruction}"

Respond with ONLY the extracted text content. Be thorough and include all relevant visible text. Do not wrap in JSON or code fences.`,
      },
    ]);

    return result.response.text().trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main browser session
// ---------------------------------------------------------------------------

export async function runBrowserSession(
  appUrl: string,
  persona: Persona,
  options: BrowserSessionOptions = {}
): Promise<BrowserSessionResult> {
  const steelApiKey = process.env.STEEL_API_KEY;
  const geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!steelApiKey) {
    throw new Error('Missing STEEL_API_KEY');
  }

  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY');
  }

  const objectivePlans = createObjectivePlans(
    options.selectedTestIds || [],
    options.structuredIntake,
    persona
  );
  const isFigmaSimulation = options.inputMode === 'figma';
  const figmaLinkType = isFigmaSimulation ? detectFigmaLinkType(appUrl) : null;
  let lastError: unknown;

  for (
    let attemptNumber = 1;
    attemptNumber <= BROWSER_SESSION_MAX_ATTEMPTS;
    attemptNumber += 1
  ) {
    try {
      return await runBrowserSessionAttempt({
        appUrl,
        steelApiKey,
        geminiApiKey,
        objectivePlans,
        figmaLinkType,
        isFigmaSimulation,
        persona,
      });
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message : 'Unknown browser session error';
      const shouldRetry =
        attemptNumber < BROWSER_SESSION_MAX_ATTEMPTS &&
        isRetryableBrowserSessionError(message);

      console.warn('Browser session attempt failed', {
        attemptNumber,
        figmaLinkType,
        isFigmaSimulation,
        message,
        shouldRetry,
      });

      if (shouldRetry) {
        await sleep(1200 * attemptNumber);
        continue;
      }

      break;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Unknown browser session error';

  if (isFigmaSimulation) {
    console.warn('[Figma] Load failed, triggering fallback', {
      figmaLinkType,
      message,
    });

    return {
      screenshots: [],
      explorationSummary: buildFigmaFallbackSummary({
        attempts: buildBrowserFailureAttempts({
          appUrl,
          objectivePlans,
          failureMessage: message,
          status: 'failed',
        }),
        figmaLinkType: figmaLinkType || 'unknown',
        screenshotCount: 0,
      }),
      pipelineNotice:
        "I couldn't fully access this Figma prototype. I'll simulate the experience based on available context.",
    };
  }

  return buildBrowserSessionFailureResult({
    appUrl,
    failureMessage: message,
    objectivePlans,
  });
}

async function runBrowserSessionAttempt({
  appUrl,
  steelApiKey,
  geminiApiKey,
  objectivePlans,
  figmaLinkType,
  isFigmaSimulation,
  persona,
}: {
  appUrl: string;
  steelApiKey: string;
  geminiApiKey: string;
  objectivePlans: ObjectivePlan[];
  figmaLinkType: FigmaLinkType | null;
  isFigmaSimulation: boolean;
  persona: Persona;
}): Promise<BrowserSessionResult> {
  const steelClient = new Steel({ steelAPIKey: steelApiKey });
  const session = await steelClient.sessions.create({ useProxy: true });

  let browser: Browser | undefined;

  const screenshots: ScreenCapture[] = [];
  const attempts: BrowserExplorationAttempt[] = [];

  try {
    browser = await chromium.connectOverCDP(
      `wss://connect.steel.dev?apiKey=${steelApiKey}&sessionId=${session.id}`
    );

    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();

    if (isFigmaSimulation) {
      console.log('[Figma] Starting load', {
        figmaLinkType,
        url: appUrl,
      });
    }

    await loadInitialPage({
      appUrl,
      figmaLinkType,
      isFigmaSimulation,
      page,
    });
    await sleep(isFigmaSimulation ? 2500 : 2000);

    screenshots.push(
      await captureScreen({
        page,
        geminiApiKey,
        captureLabel: isFigmaSimulation ? 'Figma prototype overview' : 'Landing page',
        extractInstruction:
          isFigmaSimulation
            ? `This is a Figma prototype. Extract all visible frame text, labels, buttons, navigation, annotations, and UI copy. Be thorough. ${buildPersonaExtractionLens(persona)}`
            : `Extract ALL visible text: headlines, subheadlines, body copy, button text, nav items, footer text, social proof, pricing. Be thorough. ${buildPersonaExtractionLens(persona)}`,
      })
    );

    if (isFigmaSimulation) {
      try {
        await geminiAct(
          page,
          'Scroll or pan gently to reveal more of the visible Figma prototype without attempting navigation or clicking into flows.',
          geminiApiKey,
        );
        await sleep(1500);

        screenshots.push(
          await captureScreen({
            page,
            geminiApiKey,
            captureLabel: 'Figma prototype after scroll',
            extractInstruction:
              `Extract all additional visible Figma prototype text after scrolling or panning, including frame labels, calls to action, form fields, progress cues, and screen-to-screen hints. ${buildPersonaExtractionLens(persona)}`,
          })
        );
      } catch (error) {
        console.warn('[Figma] Secondary capture skipped', {
          error,
          figmaLinkType,
        });
      }
    } else {
      await geminiAct(
        page,
        'Scroll down the page slowly to see more content',
        geminiApiKey,
      );
      await sleep(1500);

      screenshots.push(
        await captureScreen({
          page,
          geminiApiKey,
          captureLabel: 'Landing page after scroll',
          extractInstruction:
            `Extract all visible text content after scrolling, including features, testimonials, pricing, FAQ, footer, and trust signals. ${buildPersonaExtractionLens(persona)}`,
        })
      );
    }

    if (isFigmaSimulation) {
      objectivePlans.forEach((objective) => {
        attempts.push({
          testId: objective.testId,
          label: objective.label,
          goal: objective.goal,
          attemptedAction: 'Simulation mode only. No live clicking or route changes were attempted.',
          status: 'planned',
          url: page.url(),
          pageTitle: 'Figma prototype',
          observation:
            'This objective should be assessed from the captured prototype frames and visible layout cues rather than live browser navigation.',
        });
      });
      console.log('[Figma] Load succeeded', {
        figmaLinkType,
        screenshotsCaptured: screenshots.length,
      });
    } else {
      for (const objective of objectivePlans) {
        attempts.push(
          await runObjectiveAttempt({
            appUrl,
            geminiApiKey,
            objective,
            page,
            screenshots,
          })
        );
      }
    }

    return {
      screenshots,
      explorationSummary: {
        objectives: objectivePlans.map(({ testId, label, goal, observationFocus }) => ({
          testId,
          label,
          goal,
          observationFocus,
        })),
        attempts,
        summary: buildBrowserExplorationSummary(attempts),
      },
    };
  } finally {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (error) {
      console.warn('Browser close failed:', error);
    }
    try {
      await steelClient.sessions.release(session.id);
    } catch (error) {
      console.warn('Steel session release failed:', error);
    }
  }
}

function buildBrowserSessionFailureResult({
  appUrl,
  failureMessage,
  objectivePlans,
}: {
  appUrl: string;
  failureMessage: string;
  objectivePlans: ObjectivePlan[];
}): BrowserSessionResult {
  const attempts = buildBrowserFailureAttempts({
    appUrl,
    objectivePlans,
    failureMessage,
    status: 'failed',
  });
  const summarizedFailure = summarizeBrowserFailure(failureMessage);

  return {
    screenshots: [],
    explorationSummary: {
      objectives: objectivePlans.map(({ testId, label, goal, observationFocus }) => ({
        testId,
        label,
        goal,
        observationFocus,
      })),
      attempts,
      summary:
        objectivePlans.length > 0
          ? `Live browser exploration was unavailable because ${summarizedFailure}. Use the persona, selected tests, and intake context as fallback evidence for these test goals.`
          : `Live browser exploration was unavailable because ${summarizedFailure}. Use the persona and intake context as fallback evidence.`,
    },
    pipelineNotice:
      'Live browser capture was unavailable for this run. The report below is inferred from the selected persona, chosen tests, product context, and any uploaded assets.',
  };
}

function buildBrowserFailureAttempts({
  appUrl,
  objectivePlans,
  failureMessage,
  status,
}: {
  appUrl: string;
  objectivePlans: ObjectivePlan[];
  failureMessage: string;
  status: BrowserExplorationAttempt['status'];
}): BrowserExplorationAttempt[] {
  const observation = [
    `The automated browser session could not complete: ${summarizeBrowserFailure(failureMessage)}`,
    'This test should be interpreted from intake context, visible product cues, and persona expectations instead.',
  ].join(' ');

  return objectivePlans.map((objective) => ({
    testId: objective.testId,
    label: objective.label,
    goal: objective.goal,
    attemptedAction: objective.actionInstruction,
    status,
    url: appUrl,
    pageTitle: 'Browser session unavailable',
    observation,
  }));
}

function isRetryableBrowserSessionError(message: string) {
  const compact = message.replace(/\s+/g, ' ').trim().toLowerCase();

  return (
    compact.includes('browser has been closed') ||
    compact.includes('cdp connection') ||
    compact.includes('connect econnrefused') ||
    compact.includes('invalid session id') ||
    compact.includes('session') ||
    compact.includes('websocket') ||
    compact.includes('target closed')
  );
}

async function loadInitialPage({
  appUrl,
  figmaLinkType,
  isFigmaSimulation,
  page,
}: {
  appUrl: string;
  figmaLinkType: FigmaLinkType | null;
  isFigmaSimulation: boolean;
  page: Page;
}) {
  if (!isFigmaSimulation) {
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });
    return;
  }

  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (figmaLinkType === 'make') {
    return;
  }
}

async function runObjectiveAttempt({
  appUrl,
  geminiApiKey,
  objective,
  page,
  screenshots,
}: {
  appUrl: string;
  geminiApiKey: string;
  objective: ObjectivePlan;
  page: Page;
  screenshots: ScreenCapture[];
}): Promise<BrowserExplorationAttempt> {
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);

  const baseAttempt = {
    testId: objective.testId,
    label: objective.label,
    goal: objective.goal,
    attemptedAction: objective.actionInstruction,
    url: page.url(),
    pageTitle: await safePageTitle(page),
  };

  try {
    const candidates = await geminiObserve(page, objective.observeInstruction, geminiApiKey);

    if (!candidates || candidates.length === 0) {
      return {
        ...baseAttempt,
        status: 'not_found',
        observation:
          'No obvious matching page element or route was visible during this objective.',
      };
    }

    try {
      await geminiAct(page, objective.actionInstruction, geminiApiKey);
      await sleep(1800);

      const screen = await captureScreen({
        page,
        geminiApiKey,
        captureLabel: `${objective.label} evidence`,
        extractInstruction: objective.extractInstruction,
        relatedTestIds: [objective.testId],
        observation: objective.goal,
      });

      screenshots.push(screen);

      return {
        ...baseAttempt,
        status: 'completed',
        url: screen.url,
        pageTitle: screen.pageTitle,
        observation: extractAttemptObservation(screen.extractedContent),
      };
    } catch (actionError) {
      const actionMessage =
        actionError instanceof Error
          ? actionError.message
          : 'The objective action could not be completed.';

      const fallbackScreen = await captureScreen({
        page,
        geminiApiKey,
        captureLabel: `${objective.label} fallback evidence`,
        extractInstruction: objective.extractInstruction,
        relatedTestIds: [objective.testId],
        observation: `${objective.goal} Fallback evidence captured after action failure.`,
      });

      screenshots.push(fallbackScreen);

      return {
        ...baseAttempt,
        status: 'attempted',
        url: fallbackScreen.url,
        pageTitle: fallbackScreen.pageTitle,
        observation: [
          `The intended browser step was blocked: ${summarizeBrowserFailure(actionMessage)}`,
          'Fallback evidence was captured from the current visible page instead.',
          extractAttemptObservation(fallbackScreen.extractedContent),
        ].join(' '),
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Objective failed unexpectedly.';

    return {
      ...baseAttempt,
      status: 'failed',
      observation: message,
    };
  }
}

async function captureScreen({
  page,
  geminiApiKey,
  captureLabel,
  extractInstruction,
  relatedTestIds,
  observation,
}: {
  page: Page;
  geminiApiKey: string;
  captureLabel: string;
  extractInstruction: string;
  relatedTestIds?: ValidationTestId[];
  observation?: string;
}): Promise<ScreenCapture> {
  const screenshotBuffer = await page.screenshot();
  const screenshotBase64 = screenshotBuffer.toString('base64');

  // Reuse the screenshot we already took to avoid a redundant capture
  const extractedContent = await geminiExtract(
    page,
    extractInstruction,
    geminiApiKey,
    screenshotBase64,
  );

  return {
    url: page.url(),
    screenshotBase64,
    extractedContent,
    pageTitle: await safePageTitle(page),
    timestamp: Date.now(),
    captureLabel,
    relatedTestIds,
    observation,
  };
}

function createObjectivePlans(
  selectedTestIds: ValidationTestId[],
  structuredIntake?: StructuredIntakeContext,
  persona?: Persona
): ObjectivePlan[] {
  const onboardingHint =
    structuredIntake?.keyFlowsOrJobs[0] || structuredIntake?.onboardingConcerns[0] || '';
  const engagementHint =
    structuredIntake?.engagementConcerns[0] || structuredIntake?.keyFlowsOrJobs[0] || '';
  const accessibilityHint = structuredIntake?.accessibilityConcerns[0] || '';
  const complianceHint = structuredIntake?.complianceConcerns[0] || '';
  const personaActionLens = buildPersonaActionLens(persona);
  const personaExtractionLens = buildPersonaExtractionLens(persona);

  return selectedTestIds.map((testId) => {
    const label =
      VALIDATION_TEST_CATALOG.find((test) => test.id === testId)?.label || testId;

    switch (testId) {
      case 'onboarding':
        return {
          testId,
          label,
          goal:
            'Inspect how clearly a new user can enter the product, start setup, and understand the first activation step.',
          observationFocus:
            'Signup routes, onboarding copy, getting-started cues, first-task setup, and activation friction.',
          observeInstruction:
            `Find visible entry points for new users such as Sign Up, Get Started, Start Trial, Create Account, Getting Started, onboarding, or setup links. ${personaActionLens}`,
          actionInstruction: onboardingHint
            ? `Open the most relevant new-user onboarding or signup path, especially the one that appears closest to "${onboardingHint}". ${personaActionLens}`
            : `Open the most relevant new-user onboarding or signup path, preferring flows that start account creation, getting started, or setup. ${personaActionLens}`,
          extractInstruction:
            `Extract visible onboarding evidence: headings, helper text, form fields, setup steps, progress indicators, first-task guidance, activation cues, and obvious friction points. ${personaExtractionLens}`,
        };
      case 'engagement-habit-formation':
        return {
          testId,
          label,
          goal:
            'Inspect whether the product communicates repeat-use value, progress, saved work, reminders, or incentives to return.',
          observationFocus:
            'Repeat-use hooks, dashboards, progress, saved state, reminders, rewards, history, and return incentives.',
          observeInstruction:
            `Find visible elements related to ongoing value such as Features, Product, Dashboard, Progress, Templates, Analytics, History, Notifications, reminders, streaks, rewards, or saved work. ${personaActionLens}`,
          actionInstruction: engagementHint
            ? `Open the page or section most likely to explain recurring value or return incentives, especially anything connected to "${engagementHint}". ${personaActionLens}`
            : `Open the page or section most likely to explain recurring value, progress tracking, reminders, saved work, history, or reasons for a user to return. ${personaActionLens}`,
          extractInstruction:
            `Extract visible evidence of habit formation or engagement design, including dashboards, progress, saved items, reminders, recurring workflows, status, rewards, and any return incentive copy. ${personaExtractionLens}`,
        };
      case 'accessibility':
        return {
          testId,
          label,
          goal:
            'Inspect visible accessibility clues in navigation, forms, readability, labels, and error handling.',
          observationFocus:
            'Form labels, readable copy, navigation clarity, keyboard/focus clues, and visible validation or error states.',
          observeInstruction:
            `Find visible forms, menus, dialogs, navigation elements, labels, validation states, or interactive controls that would reveal accessibility clues. ${personaActionLens}`,
          actionInstruction: accessibilityHint
            ? `Open the clearest form or navigation area that could reveal accessibility clues, especially around "${accessibilityHint}". ${personaActionLens}`
            : `Open the clearest form, signup step, or navigation area that could reveal accessibility clues such as labels, instructions, errors, and navigation structure. ${personaActionLens}`,
          extractInstruction:
            `Extract visible accessibility evidence: form labels, placeholder-only fields, instructions, contrast/readability clues, navigation labels, validation messages, error states, and any focus or keyboard guidance that is visible. ${personaExtractionLens}`,
        };
      case 'compliance':
        return {
          testId,
          label,
          goal:
            'Inspect whether consent, privacy, terms, permissions, and policy disclosures are visible and easy to find.',
          observationFocus:
            'Privacy policy, terms, cookie banners, consent language, permission requests, security/compliance claims, and data-use disclosures.',
          observeInstruction:
            `Find cookie banners, privacy policy links, terms links, security/compliance pages, consent messaging, permission requests, or data-use disclosures. ${personaActionLens}`,
          actionInstruction: complianceHint
            ? `Open the most relevant privacy, policy, consent, or compliance page, especially anything related to "${complianceHint}". ${personaActionLens}`
            : `Open the most relevant privacy, policy, consent, or compliance page that is visible, preferring privacy policy, terms, security, or cookie-related routes. ${personaActionLens}`,
          extractInstruction:
            `Extract visible compliance evidence: privacy or terms copy, cookie or consent messaging, security and compliance claims, permission requests, disclaimers, policy links, and any explanation of data use. ${personaExtractionLens}`,
        };
      default:
        return {
          testId,
          label,
          goal: 'Inspect the most relevant product surface for this selected test.',
          observationFocus: 'Relevant evidence tied to the selected validation goal.',
          observeInstruction:
            `Find the most relevant visible page element, route, or entry point connected to the selected validation goal. ${personaActionLens}`,
          actionInstruction:
            `Open the page or section most relevant to the selected validation goal. ${personaActionLens}`,
          extractInstruction:
            `Extract the visible evidence most relevant to this selected validation goal. ${personaExtractionLens}`,
        };
    }
  });
}

function buildBrowserExplorationSummary(attempts: BrowserExplorationAttempt[]) {
  if (attempts.length === 0) {
    return 'The browser session used the default landing-page walkthrough only.';
  }

  return attempts
    .map((attempt) => {
      const statusLabel =
        attempt.status === 'completed'
          ? 'completed'
          : attempt.status === 'not_found'
            ? 'not found'
            : attempt.status === 'failed'
              ? 'failed'
              : attempt.status === 'planned'
                ? 'simulated'
              : attempt.status;

      return `${attempt.label}: ${statusLabel}. ${attempt.observation}`;
    })
    .join(' ');
}

function buildFigmaFallbackSummary({
  attempts,
  figmaLinkType,
  screenshotCount,
}: {
  attempts: BrowserExplorationAttempt[];
  figmaLinkType: FigmaLinkType;
  screenshotCount: number;
}): BrowserExplorationSummary {
  return {
    objectives: [],
    attempts,
    summary:
      screenshotCount > 0
        ? `Figma ${figmaLinkType} link fallback. The prototype was only partially accessible, so analysis should rely on the captured screen evidence plus simulation.`
        : `Figma ${figmaLinkType} link fallback. The prototype could not be fully accessed, so analysis should simulate the experience from available context instead of live navigation.`,
  };
}

function detectFigmaLinkType(url: string): FigmaLinkType {
  if (url.includes('/proto/')) {
    return 'proto';
  }

  if (url.includes('/file/')) {
    return 'file';
  }

  if (url.includes('/make/')) {
    return 'make';
  }

  return 'unknown';
}

async function safePageTitle(page: Page) {
  try {
    return await page.title();
  } catch {
    return 'Untitled page';
  }
}

function extractAttemptObservation(extractedContent: string) {
  const condensed = extractedContent
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);

  return condensed || 'The browser reached the page but did not extract meaningful visible text.';
}

function buildPersonaActionLens(persona?: Persona) {
  if (!persona) {
    return '';
  }

  const topGoal = persona.goals[0];
  const topFriction = persona.frustrations[0];
  const techHint =
    persona.techSavviness <= 2
      ? 'They are likely to prefer the simplest, most guided path.'
      : persona.techSavviness >= 4
        ? 'They can tolerate slightly denser flows, but still notice unnecessary friction.'
        : 'They expect a clear and dependable mainstream workflow.';

  return [
    `Use ${persona.name}'s lens as a ${persona.jobTitle}.`,
    topGoal ? `Prioritize what helps them achieve "${topGoal}".` : '',
    topFriction ? `Watch closely for anything that triggers "${topFriction}".` : '',
    techHint,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildPersonaExtractionLens(persona?: Persona) {
  if (!persona) {
    return '';
  }

  const signupTrigger = persona.signupTriggers[0];
  const bounceTrigger = persona.bounceTriggers[0];

  return [
    `Extract the details that would matter most to ${persona.name}.`,
    signupTrigger ? `Highlight anything that supports "${signupTrigger}".` : '',
    bounceTrigger ? `Highlight anything that could cause them to leave because of "${bounceTrigger}".` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function summarizeBrowserFailure(message: string) {
  const compact = message.replace(/\s+/g, ' ').trim();

  if (/shadow dom/i.test(compact)) {
    return 'A key interaction was inside a shadow DOM, so the browser could not complete that step directly.';
  }

  return compact.slice(0, 220);
}

import { Stagehand } from '@browserbasehq/stagehand';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBrowserSession(
  appUrl: string,
  _persona: Persona,
  options: BrowserSessionOptions = {}
): Promise<BrowserSessionResult> {
  const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
  const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;
  const geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!browserbaseApiKey) {
    throw new Error('Missing BROWSERBASE_API_KEY');
  }

  if (!browserbaseProjectId) {
    throw new Error('Missing BROWSERBASE_PROJECT_ID');
  }

  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY');
  }

  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: browserbaseApiKey,
    projectId: browserbaseProjectId,
    modelName: 'google/gemini-2.5-flash',
    modelClientOptions: {
      apiKey: geminiApiKey,
    },
  });

  const screenshots: ScreenCapture[] = [];
  const objectivePlans = createObjectivePlans(
    options.selectedTestIds || [],
    options.structuredIntake
  );
  const attempts: BrowserExplorationAttempt[] = [];
  const isFigmaSimulation = options.inputMode === 'figma';
  const figmaLinkType = isFigmaSimulation ? detectFigmaLinkType(appUrl) : null;

  try {
    await stagehand.init();
    const page = stagehand.page;

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
        captureLabel: isFigmaSimulation ? 'Figma prototype overview' : 'Landing page',
        extractInstruction:
          isFigmaSimulation
            ? 'This is a Figma prototype. Extract all visible frame text, labels, buttons, navigation, annotations, and UI copy. Be thorough.'
            : 'Extract ALL visible text: headlines, subheadlines, body copy, button text, nav items, footer text, social proof, pricing. Be thorough.',
      })
    );

    if (isFigmaSimulation) {
      try {
        await page.act({
          action:
            'Scroll or pan gently to reveal more of the visible Figma prototype without attempting navigation or clicking into flows.',
        });
        await sleep(1500);

        screenshots.push(
          await captureScreen({
            page,
            captureLabel: 'Figma prototype after scroll',
            extractInstruction:
              'Extract all additional visible Figma prototype text after scrolling or panning, including frame labels, calls to action, form fields, progress cues, and screen-to-screen hints.',
          })
        );
      } catch (error) {
        console.warn('[Figma] Secondary capture skipped', {
          error,
          figmaLinkType,
        });
      }
    } else {
      await page.act({
        action: 'Scroll down the page slowly to see more content',
      });
      await sleep(1500);

      screenshots.push(
        await captureScreen({
          page,
          captureLabel: 'Landing page after scroll',
          extractInstruction:
            'Extract all visible text content after scrolling, including features, testimonials, pricing, FAQ, footer, and trust signals.',
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (isFigmaSimulation) {
      console.warn('[Figma] Load failed, triggering fallback', {
        figmaLinkType,
        message,
      });

      return {
        screenshots,
        explorationSummary: buildFigmaFallbackSummary({
          attempts,
          figmaLinkType: figmaLinkType || 'unknown',
          screenshotCount: screenshots.length,
        }),
        pipelineNotice:
          "I couldn't fully access this Figma prototype. I'll simulate the experience based on available context.",
      };
    }

    throw new Error(`Browser session failed: ${message}`);
  } finally {
    await stagehand.close();
  }
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
  page: Stagehand['page'];
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
  objective,
  page,
  screenshots,
}: {
  appUrl: string;
  objective: ObjectivePlan;
  page: Stagehand['page'];
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
    const candidates = await page.observe({
      instruction: objective.observeInstruction,
    });

    if (!candidates || candidates.length === 0) {
      return {
        ...baseAttempt,
        status: 'not_found',
        observation:
          'No obvious matching page element or route was visible during this objective.',
      };
    }

    await page.act({
      action: objective.actionInstruction,
    });
    await sleep(1800);

    const screen = await captureScreen({
      page,
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
  captureLabel,
  extractInstruction,
  relatedTestIds,
  observation,
}: {
  page: Stagehand['page'];
  captureLabel: string;
  extractInstruction: string;
  relatedTestIds?: ValidationTestId[];
  observation?: string;
}): Promise<ScreenCapture> {
  const screenshotBuffer = await page.screenshot();
  const extracted = await page.extract({
    instruction: extractInstruction,
  });

  return {
    url: page.url(),
    screenshotBase64: screenshotBuffer.toString('base64'),
    extractedContent:
      typeof extracted?.extraction === 'string'
        ? extracted.extraction
        : JSON.stringify(extracted ?? {}),
    pageTitle: await safePageTitle(page),
    timestamp: Date.now(),
    captureLabel,
    relatedTestIds,
    observation,
  };
}

function createObjectivePlans(
  selectedTestIds: ValidationTestId[],
  structuredIntake?: StructuredIntakeContext
): ObjectivePlan[] {
  const onboardingHint =
    structuredIntake?.keyFlowsOrJobs[0] || structuredIntake?.onboardingConcerns[0] || '';
  const engagementHint =
    structuredIntake?.engagementConcerns[0] || structuredIntake?.keyFlowsOrJobs[0] || '';
  const accessibilityHint = structuredIntake?.accessibilityConcerns[0] || '';
  const complianceHint = structuredIntake?.complianceConcerns[0] || '';

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
            'Find visible entry points for new users such as Sign Up, Get Started, Start Trial, Create Account, Getting Started, onboarding, or setup links.',
          actionInstruction: onboardingHint
            ? `Open the most relevant new-user onboarding or signup path, especially the one that appears closest to "${onboardingHint}".`
            : 'Open the most relevant new-user onboarding or signup path, preferring flows that start account creation, getting started, or setup.',
          extractInstruction:
            'Extract visible onboarding evidence: headings, helper text, form fields, setup steps, progress indicators, first-task guidance, activation cues, and obvious friction points.',
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
            'Find visible elements related to ongoing value such as Features, Product, Dashboard, Progress, Templates, Analytics, History, Notifications, reminders, streaks, rewards, or saved work.',
          actionInstruction: engagementHint
            ? `Open the page or section most likely to explain recurring value or return incentives, especially anything connected to "${engagementHint}".`
            : 'Open the page or section most likely to explain recurring value, progress tracking, reminders, saved work, history, or reasons for a user to return.',
          extractInstruction:
            'Extract visible evidence of habit formation or engagement design, including dashboards, progress, saved items, reminders, recurring workflows, status, rewards, and any return incentive copy.',
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
            'Find visible forms, menus, dialogs, navigation elements, labels, validation states, or interactive controls that would reveal accessibility clues.',
          actionInstruction: accessibilityHint
            ? `Open the clearest form or navigation area that could reveal accessibility clues, especially around "${accessibilityHint}".`
            : 'Open the clearest form, signup step, or navigation area that could reveal accessibility clues such as labels, instructions, errors, and navigation structure.',
          extractInstruction:
            'Extract visible accessibility evidence: form labels, placeholder-only fields, instructions, contrast/readability clues, navigation labels, validation messages, error states, and any focus or keyboard guidance that is visible.',
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
            'Find cookie banners, privacy policy links, terms links, security/compliance pages, consent messaging, permission requests, or data-use disclosures.',
          actionInstruction: complianceHint
            ? `Open the most relevant privacy, policy, consent, or compliance page, especially anything related to "${complianceHint}".`
            : 'Open the most relevant privacy, policy, consent, or compliance page that is visible, preferring privacy policy, terms, security, or cookie-related routes.',
          extractInstruction:
            'Extract visible compliance evidence: privacy or terms copy, cookie or consent messaging, security and compliance claims, permission requests, disclaimers, policy links, and any explanation of data use.',
        };
      default:
        return {
          testId,
          label,
          goal: 'Inspect the most relevant product surface for this selected test.',
          observationFocus: 'Relevant evidence tied to the selected validation goal.',
          observeInstruction:
            'Find the most relevant visible page element, route, or entry point connected to the selected validation goal.',
          actionInstruction:
            'Open the page or section most relevant to the selected validation goal.',
          extractInstruction:
            'Extract the visible evidence most relevant to this selected validation goal.',
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

async function safePageTitle(page: Stagehand['page']) {
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

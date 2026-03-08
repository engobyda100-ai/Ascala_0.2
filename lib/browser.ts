import { Stagehand } from '@browserbasehq/stagehand';
import { Persona, ScreenCapture } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBrowserSession(
  appUrl: string,
  _persona: Persona
): Promise<ScreenCapture[]> {
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
    throw new Error(
      'Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY'
    );
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

  const screens: ScreenCapture[] = [];

  try {
    await stagehand.init();
    const page = stagehand.page;

    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    const landingBuffer = await page.screenshot();
    const landingContent = await page.extract({
      instruction:
        'Extract ALL visible text: headlines, subheadlines, body copy, button text, nav items, footer text, social proof, pricing. Be thorough.',
    });

    screens.push({
      url: page.url(),
      screenshotBase64: landingBuffer.toString('base64'),
      extractedContent:
        typeof landingContent?.extraction === 'string'
          ? landingContent.extraction
          : JSON.stringify(landingContent ?? {}),
      pageTitle: await page.title(),
      timestamp: Date.now(),
    });

    await page.act({
      action: 'Scroll down the page slowly to see more content',
    });
    await sleep(1500);

    const scrolledBuffer = await page.screenshot();
    const scrolledContent = await page.extract({
      instruction:
        'Extract all visible text content after scrolling, including features, testimonials, pricing, FAQ, footer.',
    });

    screens.push({
      url: page.url(),
      screenshotBase64: scrolledBuffer.toString('base64'),
      extractedContent:
        typeof scrolledContent?.extraction === 'string'
          ? scrolledContent.extraction
          : JSON.stringify(scrolledContent ?? {}),
      pageTitle: `${await page.title()} (scrolled)`,
      timestamp: Date.now(),
    });

    try {
      const ctaElements = await page.observe({
        instruction:
          'Find buttons or links that say things like Pricing, Get Started, Sign Up, Try Free, Start Trial, or Demo',
      });

      if (ctaElements && ctaElements.length > 0) {
        await page.act({
          action:
            'Click the most prominent call-to-action button (Get Started, Sign Up, Try Free, etc.)',
        });
        await sleep(2000);

        const ctaBuffer = await page.screenshot();
        const ctaContent = await page.extract({
          instruction:
            'Extract all visible text on this page — form fields, headings, pricing details, plan comparisons, and any instructions.',
        });

        screens.push({
          url: page.url(),
          screenshotBase64: ctaBuffer.toString('base64'),
          extractedContent:
            typeof ctaContent?.extraction === 'string'
              ? ctaContent.extraction
              : JSON.stringify(ctaContent ?? {}),
          pageTitle: await page.title(),
          timestamp: Date.now(),
        });
      }
    } catch {
      // CTA not found or click failed — continue with what we have
    }

    return screens;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Browser session failed: ${message}`);
  } finally {
    await stagehand.close();
  }
}
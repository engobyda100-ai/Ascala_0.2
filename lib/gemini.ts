import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Part,
} from '@google/generative-ai';
import {
  BrowserExplorationSummary,
  ChatAgentRequest,
  ChatAgentResponse,
  GeneratedPersona,
  InputMode,
  Persona,
  ReviewAttachedFileMetadata,
  ResultActionPriority,
  ResultActionableChange,
  ResultNarrativeBlocks,
  ResultQuotes,
  ScreenCapture,
  StructuredIntakeContext,
  StructuredIntakeUpdate,
  UXAnalysis,
  VALIDATION_TEST_CATALOG,
  ValidationTestId,
  ValidationResultSummary,
  ValidationResultTestSummary,
  ValidationTestResult,
  WorkspaceRunState,
} from './types';
import {
  PERSONA_PROMPT,
  PERSONA_SET_PROMPT,
  ANALYSIS_PROMPT,
  INTAKE_CHAT_PROMPT,
} from './prompts';

const ACTIONABLE_CHANGE_PRIORITIES = ['urgent', 'important', 'later'] as const;
const INSIGHT_ORDINAL_LABELS = ['first', 'second', 'third'] as const;

interface ReviewContextOptions {
  attachedFiles?: ReviewAttachedFileMetadata[];
  browserExplorationSummary?: BrowserExplorationSummary;
  inputMode?: InputMode;
  intakeSummary?: string;
  personaCount?: number;
  productContext?: string;
  structuredIntake?: StructuredIntakeContext;
  selectedTestIds?: ValidationTestId[];
}

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
export async function generatePersona(
  targetMarket: string,
  options: ReviewContextOptions = {}
): Promise<Persona> {
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

    const prompt = buildPersonaPrompt(PERSONA_PROMPT, targetMarket, options);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      console.warn('Persona generation returned an empty response. Using fallback persona.', {
        inputMode: options.inputMode || 'url',
      });
      return createFallbackPersona(options.inputMode);
    }

    return parsePersonaResponse(text, options.inputMode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API key') ||
      message.includes('GEMINI') ||
      message.includes('Gemini API key')
    ) {
      throw new Error(`Gemini API error: ${message}`);
    }
    console.error('Persona generation failed. Falling back to default persona.', {
      error,
      inputMode: options.inputMode || 'url',
    });
    return createFallbackPersona(options.inputMode);
  }
}

export async function generatePersonas(
  targetMarket: string,
  options: ReviewContextOptions = {}
): Promise<GeneratedPersona[]> {
  const personaCount = normalizePersonaCount(options.personaCount);

  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      safetySettings,
    });

    const prompt = buildPersonaPrompt(PERSONA_SET_PROMPT, targetMarket, options);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      console.warn('Persona set generation returned an empty response. Using fallback personas.', {
        inputMode: options.inputMode || 'url',
        personaCount,
      });
      return createFallbackGeneratedPersonas(options.inputMode, personaCount);
    }

    return parseGeneratedPersonasResponse(text, options.inputMode, personaCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API key') ||
      message.includes('GEMINI') ||
      message.includes('Gemini API key')
    ) {
      throw new Error(`Gemini API error: ${message}`);
    }

    console.error('Persona set generation failed. Falling back to default personas.', {
      error,
      inputMode: options.inputMode || 'url',
      personaCount,
    });
    return createFallbackGeneratedPersonas(options.inputMode, personaCount);
  }
}

/**
 * Analyze an app through a persona's lens using Gemini multimodal.
 */
export async function analyzeApp(
  persona: Persona,
  screens: ScreenCapture[],
  options: ReviewContextOptions = {}
): Promise<UXAnalysis> {
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
      .replace('{{EXTRACTED_CONTENT}}', extractedContent)
      .replace('{{PRODUCT_CONTEXT}}', formatOptionalText(options.productContext))
      .replace(
        '{{BROWSER_EXPLORATION_SUMMARY}}',
        formatBrowserExplorationSummary(options.browserExplorationSummary)
      )
      .replace('{{STRUCTURED_INTAKE}}', formatStructuredIntake(options.structuredIntake))
      .replace('{{INTAKE_SUMMARY}}', formatOptionalText(options.intakeSummary))
      .replace('{{SELECTED_TESTS}}', formatSelectedTests(options.selectedTestIds))
      .replace('{{ATTACHED_FILES}}', formatAttachedFiles(options.attachedFiles))
      .replace('{{INPUT_MODE}}', formatInputMode(options.inputMode))
      .replace(
        '{{SCREENSHOT_FLOW_GUIDANCE}}',
        formatScreenshotFlowGuidance(options.inputMode, screens)
      )
      .replace(
        '{{ATTACHED_FILE_CONTEXT}}',
        formatAttachedFileContext(options.attachedFiles)
      );

    const parts: Part[] = [{ text: prompt }];

    for (const screen of screens) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: screen.screenshotBase64,
        },
      });
      parts.push({
        text: `[Screenshot of: ${screen.pageTitle} — ${screen.url}${screen.captureLabel ? ` — ${screen.captureLabel}` : ''}${screen.relatedTestIds?.length ? ` — related tests: ${screen.relatedTestIds.join(', ')}` : ''}]`,
      });
    }

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return normalizeAnalysisResult(
      JSON.parse(text) as UXAnalysis,
      options.selectedTestIds,
      options.browserExplorationSummary
    );
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

export async function generateIntakeCoachResponse(
  request: ChatAgentRequest
): Promise<ChatAgentResponse> {
  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      safetySettings,
    });

    const prompt = INTAKE_CHAT_PROMPT
      .replace('{{RECENT_MESSAGES}}', formatRecentMessages(request.recentMessages))
      .replace('{{RUN_STATUS}}', formatRunStatus(request.runState))
      .replace('{{CURRENT_STAGE}}', request.currentStage?.trim() || 'No active stage.')
      .replace('{{SELECTED_TESTS}}', formatSelectedTests(request.selectedTestIds))
      .replace(
        '{{STRUCTURED_INTAKE}}',
        formatStructuredIntake(request.structuredIntake)
      )
      .replace('{{SELECTED_PERSONA}}', formatSelectedPersona(request.selectedPersona))
      .replace(
        '{{LATEST_RESULTS_SUMMARY}}',
        formatLatestResultsSummary(request.latestResultsSummary)
      )
      .replace(
        '{{SELECTED_TEST_RESULTS}}',
        formatSelectedTestResults(request.selectedTestResults)
      )
      .replace(
        '{{BROWSER_EXPLORATION_SUMMARY}}',
        formatBrowserExplorationSummary(request.browserExplorationSummary)
      )
      .replace('{{ATTACHED_FILES}}', formatAttachedFiles(request.attachedFiles))
      .replace(
        '{{ATTACHED_FILE_CONTEXT}}',
        formatAttachedFileContext(request.attachedFiles)
      )
      .replace('{{CHAT_TRIGGER}}', request.trigger || 'message');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return normalizeChatAgentResponse(JSON.parse(text) as ChatAgentResponse);
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
      throw new Error(`Failed to parse chat JSON: ${message}`);
    }

    throw new Error(`Intake chat failed: ${message}`);
  }
}

function buildPersonaPrompt(
  template: string,
  targetMarket: string,
  options: ReviewContextOptions
) {
  return template
    .replace('{{TARGET_MARKET}}', targetMarket)
    .replace('{{PERSONA_COUNT}}', String(normalizePersonaCount(options.personaCount)))
    .replace('{{PRODUCT_CONTEXT}}', formatOptionalText(options.productContext))
    .replace('{{STRUCTURED_INTAKE}}', formatStructuredIntake(options.structuredIntake))
    .replace('{{INTAKE_SUMMARY}}', formatOptionalText(options.intakeSummary))
    .replace('{{ATTACHED_FILES}}', formatAttachedFiles(options.attachedFiles))
    .replace('{{INPUT_MODE}}', formatInputMode(options.inputMode))
    .replace('{{PERSONA_CONTEXT}}', formatPersonaContext(options.inputMode))
    .replace(
      '{{ATTACHED_FILE_CONTEXT}}',
      formatAttachedFileContext(options.attachedFiles)
    );
}

function formatOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'No additional intake context provided.';
}

function formatRecentMessages(messages: ChatAgentRequest['recentMessages']) {
  if (!messages || messages.length === 0) {
    return 'No prior chat messages.';
  }

  return messages
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');
}

function formatStructuredIntake(structuredIntake?: StructuredIntakeContext) {
  if (!structuredIntake) {
    return 'No structured intake context provided.';
  }

  const sections = [
    formatStructuredField('Product summary', structuredIntake.productSummary),
    formatStructuredField('Target audience', structuredIntake.targetAudience),
    formatStructuredList('Audience needs', structuredIntake.audienceNeeds),
    formatStructuredList('Key flows or jobs', structuredIntake.keyFlowsOrJobs),
    formatStructuredList('Onboarding concerns', structuredIntake.onboardingConcerns),
    formatStructuredList('Engagement concerns', structuredIntake.engagementConcerns),
    formatStructuredList(
      'Accessibility concerns',
      structuredIntake.accessibilityConcerns
    ),
    formatStructuredList('Compliance concerns', structuredIntake.complianceConcerns),
    formatStructuredField('Additional notes', structuredIntake.additionalNotes),
  ].filter(Boolean);

  return sections.length > 0
    ? sections.join('\n')
    : 'No structured intake context provided.';
}

function formatSelectedTests(selectedTestIds?: string[]) {
  if (!selectedTestIds || selectedTestIds.length === 0) {
    return 'No selected tests were provided. Use general UX judgment.';
  }

  return selectedTestIds
    .map((id) => {
      const match = VALIDATION_TEST_CATALOG.find((test) => test.id === id);
      return match ? `${match.id}: ${match.label}` : id;
    })
    .join('\n');
}

function formatAttachedFiles(attachedFiles?: ReviewAttachedFileMetadata[]) {
  if (!attachedFiles || attachedFiles.length === 0) {
    return 'No attached file metadata provided.';
  }

  return attachedFiles
    .map((file) => {
      const status = file.ingestionStatus || 'metadata-only';
      return `${file.name} (${file.type || 'unknown type'}, ${file.size} bytes, ${status})`;
    })
    .join('\n');
}

function formatLatestResultsSummary(
  latestResultsSummary?: ValidationResultSummary | null
) {
  if (!latestResultsSummary) {
    return 'No results summary is available yet.';
  }

  return [
    `Overall score: ${latestResultsSummary.overallScore}/100`,
    `Summary: ${latestResultsSummary.summary}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatStructuredField(label: string, value?: string) {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : '';
}

function formatSelectedPersona(selectedPersona?: GeneratedPersona | null) {
  if (!selectedPersona) {
    return 'No selected persona is active.';
  }

  return [
    `Name: ${selectedPersona.name}`,
    selectedPersona.description ? `Description: ${selectedPersona.description}` : '',
    `Role: ${selectedPersona.jobTitle}`,
    `Company size: ${selectedPersona.companySize}`,
    `Tech savviness: ${selectedPersona.techSavviness}/5`,
    selectedPersona.goals.length > 0
      ? `Goals:\n- ${selectedPersona.goals.join('\n- ')}`
      : '',
    selectedPersona.frustrations.length > 0
      ? `Frustrations:\n- ${selectedPersona.frustrations.join('\n- ')}`
      : '',
    selectedPersona.quote ? `Mindset quote: ${selectedPersona.quote}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatBrowserExplorationSummary(
  browserExplorationSummary?: BrowserExplorationSummary
) {
  if (!browserExplorationSummary) {
    return 'No additional test-aware browser exploration summary was provided.';
  }

  const objectiveLines = browserExplorationSummary.objectives.map(
    (objective) =>
      `${objective.label} (${objective.testId}): ${objective.goal} Focus: ${objective.observationFocus}`
  );
  const attemptLines = browserExplorationSummary.attempts.map(
    (attempt) =>
      `${attempt.label} [${attempt.status}] at ${attempt.url}: ${attempt.observation}`
  );

  return [
    browserExplorationSummary.summary,
    objectiveLines.length > 0 ? `Objectives:\n- ${objectiveLines.join('\n- ')}` : '',
    attemptLines.length > 0 ? `Attempts:\n- ${attemptLines.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSelectedTestResults(
  selectedTestResults?: ValidationResultTestSummary[]
) {
  if (!selectedTestResults || selectedTestResults.length === 0) {
    return 'No per-test results are available yet.';
  }

  return selectedTestResults
    .map((test) => {
      return `${test.label} (${test.id}) [${test.status}] ${
        typeof test.score === 'number' ? `${test.score}/100` : 'pending'
      }\nSummary: ${test.summary}\n${formatNarrativeBlocks(test)}`;
    })
    .join('\n\n');
}

function formatNarrativeBlocks(
  narrative: Pick<ResultNarrativeBlocks, 'quotes' | 'actionableChanges' | 'keyInsights'>
) {
  const actionableChanges = narrative.actionableChanges
    .map((change) => `${capitalizePriority(change.priority)}: ${change.text}`)
    .join('\n- ');
  const keyInsights = narrative.keyInsights.join('\n- ');

  return [
    `Positive quote: ${narrative.quotes.positive}`,
    `Negative quote: ${narrative.quotes.negative}`,
    actionableChanges ? `Actionable changes:\n- ${actionableChanges}` : '',
    keyInsights ? `Key insights:\n- ${keyInsights}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatRunStatus(runState?: WorkspaceRunState) {
  if (!runState) {
    return 'No run status provided.';
  }

  return [
    `Status: ${runState.status}`,
    runState.error ? `Error: ${runState.error}` : '',
    runState.lastRunAt ? `Last run: ${runState.lastRunAt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatStructuredList(label: string, items: string[]) {
  if (!items || items.length === 0) {
    return '';
  }

  return `${label}:\n- ${items.join('\n- ')}`;
}

function formatAttachedFileContext(attachedFiles?: ReviewAttachedFileMetadata[]) {
  if (!attachedFiles || attachedFiles.length === 0) {
    return 'No attached file text context provided.';
  }

  const filesWithText = attachedFiles.filter((file) => file.extractedText?.trim());

  if (filesWithText.length === 0) {
    return 'Attached files are available as metadata only. No extracted document text was available.';
  }

  return filesWithText
    .map((file) => {
      const text = file.extractedText?.trim().slice(0, 3000) || '';
      return `FILE: ${file.name}\n${text}`;
    })
    .join('\n\n---\n\n')
    .slice(0, 12000);
}

function formatInputMode(inputMode?: InputMode) {
  if (inputMode === 'figma') {
    return 'Figma prototype. Simulate user interaction based on the visual layout instead of assuming live clickable navigation.';
  }

  if (inputMode === 'screenshots') {
    return 'Screenshot-only input. Use the provided images as static evidence and do not assume a live product session.';
  }

  if (inputMode === 'video') {
    return 'Video input. Use sampled frames from uploaded videos as static journey evidence and do not assume a live product session.';
  }

  return 'Live product URL.';
}

function formatScreenshotFlowGuidance(
  inputMode: InputMode | undefined,
  screens: ScreenCapture[]
) {
  if (inputMode !== 'screenshots') {
    if (inputMode === 'video') {
      if (screens.length <= 1) {
        return 'Single-frame video mode. Treat this as a first visible moment from an uploaded video and simulate what a first-time user would notice, understand, and try next.';
      }

      const steps = screens
        .map(
          (screen, index) =>
            `Step ${index + 1}: ${screen.pageTitle}${screen.captureLabel ? ` (${screen.captureLabel})` : ''}`
        )
        .join('\n');

      return [
        'You are simulating a real user interacting with this product through sampled frames from uploaded videos.',
        'Treat the frames as a logical flow in order.',
        'For each frame: 1. Describe what the user sees 2. What the user is likely trying to do 3. What is clear vs confusing 4. What action they would take next.',
        'Then identify the biggest friction point across the flow, provide 1 key insight, and provide 1 recommended next action.',
        `Observed sequence:\n${steps}`,
      ].join('\n');
    }

    return 'No screenshot-specific flow guidance.';
  }

  if (screens.length <= 1) {
    return 'Single screenshot mode. Treat this as a landing or first-impression experience and simulate what a first-time user would notice, understand, and try next.';
  }

  const steps = screens
    .map(
      (screen, index) =>
        `Step ${index + 1}: ${screen.pageTitle}${screen.captureLabel ? ` (${screen.captureLabel})` : ''}`
    )
    .join('\n');

  return [
    'You are simulating a real user interacting with this product through a sequence of UI screens.',
    'Treat the screenshots as a logical flow in order.',
    'For each screen: 1. Describe what the user sees 2. What the user is likely trying to do 3. What is clear vs confusing 4. What action they would take next.',
    'Then identify the biggest friction point across the flow, provide 1 key insight, and provide 1 recommended next action.',
    'Use that flow simulation to make the existing JSON output more concrete and sequential rather than generic.',
    `Observed sequence:\n${steps}`,
  ].join('\n');
}

function formatPersonaContext(inputMode?: InputMode) {
  if (inputMode === 'screenshots') {
    return 'User is interacting with a product based on UI screenshots. The persona should be resilient to partial context and static visual evidence.';
  }

  if (inputMode === 'video') {
    return 'User is interacting with a product based on uploaded product videos summarized into visible frames. The persona should reason from observed moments in the flow.';
  }

  if (inputMode === 'figma') {
    return 'User is interacting with a prototype. The persona should reflect early-stage product evaluation and incomplete flows.';
  }

  return 'User is interacting with a live product URL.';
}

function parsePersonaResponse(rawText: string, inputMode?: InputMode): Persona {
  console.log('Raw Gemini persona response:', rawText);

  try {
    const parsed = JSON.parse(rawText) as Partial<Persona>;
    return normalizePersona(parsed, inputMode);
  } catch (error) {
    console.error('Persona JSON parse failed. Using fallback persona.', {
      error,
      rawResponse: rawText,
      inputMode: inputMode || 'url',
    });
    return createFallbackPersona(inputMode);
  }
}

function parseGeneratedPersonasResponse(
  rawText: string,
  inputMode?: InputMode,
  personaCount = 3
): GeneratedPersona[] {
  console.log('Raw Gemini persona set response:', rawText);

  try {
    const parsed = JSON.parse(rawText) as
      | { personas?: Partial<Persona>[] }
      | Partial<Persona>[];
    const personaCandidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.personas)
        ? parsed.personas
        : [];

    return normalizeGeneratedPersonas(personaCandidates, inputMode, personaCount);
  } catch (error) {
    console.error('Persona set JSON parse failed. Using fallback personas.', {
      error,
      rawResponse: rawText,
      inputMode: inputMode || 'url',
      personaCount,
    });
    return createFallbackGeneratedPersonas(inputMode, personaCount);
  }
}

function normalizePersona(persona: Partial<Persona>, inputMode?: InputMode): Persona {
  return normalizePersonaWithFallback(persona, createFallbackPersona(inputMode));
}

function normalizePersonaWithFallback(
  persona: Partial<Persona>,
  fallback: Persona
): Persona {
  return {
    name: persona.name?.trim() || fallback.name,
    description: persona.description?.trim() || fallback.description,
    age:
      typeof persona.age === 'number' && Number.isFinite(persona.age)
        ? Math.max(18, Math.round(persona.age))
        : fallback.age,
    jobTitle: persona.jobTitle?.trim() || fallback.jobTitle,
    companySize: persona.companySize?.trim() || fallback.companySize,
    goals: normalizePersonaList(persona.goals, fallback.goals),
    frustrations: normalizePersonaList(persona.frustrations, fallback.frustrations),
    techSavviness:
      typeof persona.techSavviness === 'number' && Number.isFinite(persona.techSavviness)
        ? Math.max(1, Math.min(5, Math.round(persona.techSavviness)))
        : fallback.techSavviness,
    quote: persona.quote?.trim() || fallback.quote,
    signupTriggers: normalizePersonaList(persona.signupTriggers, fallback.signupTriggers),
    bounceTriggers: normalizePersonaList(persona.bounceTriggers, fallback.bounceTriggers),
  };
}

function normalizeGeneratedPersonas(
  personas: Partial<Persona>[],
  inputMode?: InputMode,
  personaCount = 3
): GeneratedPersona[] {
  const normalizedPersonaCount = normalizePersonaCount(personaCount);
  const fallbackPersonas = createFallbackGeneratedPersonas(
    inputMode,
    normalizedPersonaCount
  );
  const normalized = personas
    .slice(0, normalizedPersonaCount)
    .map((persona, index) =>
      normalizePersonaWithFallback(persona, fallbackPersonas[index] || fallbackPersonas[0])
    );

  while (normalized.length < normalizedPersonaCount) {
    normalized.push(fallbackPersonas[normalized.length] || fallbackPersonas[0]);
  }

  return assignPersonaIds(normalized.slice(0, normalizedPersonaCount));
}

function normalizePersonaList(items: string[] | undefined, fallback: string[]) {
  const normalized = (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  return normalized.length > 0 ? normalized : fallback;
}

function createFallbackPersona(inputMode?: InputMode): Persona {
  const description =
    inputMode === 'screenshots'
      ? 'A typical first-time user interpreting the product from UI screenshots alone.'
      : inputMode === 'video'
        ? 'A typical first-time user interpreting the product from sampled frames taken from uploaded videos.'
      : inputMode === 'figma'
        ? 'A typical first-time user exploring an early interactive prototype.'
        : 'A typical first-time user exploring the product.';

  return {
    name: 'General User',
    description,
    age: 32,
    jobTitle: 'Prospective customer',
    companySize: '10-50 employees',
    goals: ['Understand the product', 'Complete a basic task', 'Decide whether it feels useful'],
    frustrations: ['Confusing interface', 'Unclear next steps', 'Missing context or guidance'],
    techSavviness: 3,
    quote: 'I want to quickly understand what this does and whether it is worth my time.',
    signupTriggers: ['Clear value proposition', 'Obvious next step', 'Low-friction first experience'],
    bounceTriggers: ['Confusing interface', 'Unclear next steps', 'Too much effort upfront'],
  };
}

function createFallbackGeneratedPersonas(
  inputMode?: InputMode,
  personaCount = 3
): GeneratedPersona[] {
  const descriptionByMode =
    inputMode === 'screenshots'
      ? 'Evaluating the product from static screen evidence and looking for clear next steps.'
      : inputMode === 'video'
        ? 'Evaluating the product from sampled frames and trying to reconstruct the likely journey.'
        : inputMode === 'figma'
          ? 'Evaluating an early prototype and noticing where the flow still feels unfinished.'
          : 'Evaluating the live product and deciding whether it feels usable and trustworthy.';

  const fallbackPersonas: Persona[] = [
    {
      name: 'Maya Chen',
      description: descriptionByMode,
      age: 32,
      jobTitle: 'Growth Lead',
      companySize: '11-50 employees',
      goals: ['Understand the product quickly', 'Reach first value without friction', 'Decide if the workflow is launch-ready'],
      frustrations: ['Unclear onboarding path', 'Too many steps before value', 'Weak signals of momentum'],
      techSavviness: 4,
      quote: 'If the first few moments feel muddy, I stop trusting the rest of the flow.',
      signupTriggers: ['Clear first action', 'Evidence of fast payoff', 'Low-friction setup'],
      bounceTriggers: ['Confusing copy', 'Hidden next step', 'Overly slow setup'],
    },
    {
      name: 'Jordan Rivera',
      description: descriptionByMode,
      age: 41,
      jobTitle: 'Operations Manager',
      companySize: '51-200 employees',
      goals: ['Check whether the product feels dependable', 'Confirm risky flows are understandable', 'Avoid errors that create support issues'],
      frustrations: ['Missing trust cues', 'Weak error prevention', 'Anything that feels brittle under pressure'],
      techSavviness: 3,
      quote: 'I need to feel like the product will hold up when the stakes are real.',
      signupTriggers: ['Trustworthy language', 'Clear expectations', 'Visible safeguards'],
      bounceTriggers: ['Risky-looking flows', 'Poor instructions', 'Unclear recovery from mistakes'],
    },
    {
      name: 'Amira Patel',
      description: descriptionByMode,
      age: 28,
      jobTitle: 'Product Designer',
      companySize: '2-10 employees',
      goals: ['Judge clarity of the interface', 'Spot copy and interaction friction quickly', 'See whether the experience feels coherent end to end'],
      frustrations: ['Inconsistent interaction patterns', 'Ambiguous interface labels', 'Missing guidance at key moments'],
      techSavviness: 5,
      quote: 'When the interface makes me stop and translate what it means, the experience is already losing me.',
      signupTriggers: ['Clear hierarchy', 'Confident wording', 'Visible flow logic'],
      bounceTriggers: ['Ambiguous controls', 'Broken momentum', 'Unexplained UI states'],
    },
    {
      name: 'Elena Brooks',
      description: descriptionByMode,
      age: 36,
      jobTitle: 'Customer Success Director',
      companySize: '201-500 employees',
      goals: ['Evaluate how quickly new users can succeed', 'Reduce support-heavy friction', 'Find where guidance breaks down'],
      frustrations: ['Too much hidden setup work', 'Missing onboarding cues', 'Confusing error states'],
      techSavviness: 4,
      quote: 'If I can already imagine the support tickets, the product is not ready.',
      signupTriggers: ['Guided setup', 'Clear reassurance', 'Visible progress indicators'],
      bounceTriggers: ['Dead-end flows', 'Missing help', 'Hard-to-recover mistakes'],
    },
    {
      name: 'Noah Fischer',
      description: descriptionByMode,
      age: 30,
      jobTitle: 'Founder',
      companySize: '1-10 employees',
      goals: ['Validate the core value quickly', 'See momentum immediately', 'Avoid wasting time on slow setup'],
      frustrations: ['Slow time to value', 'Generic messaging', 'Too many screens before payoff'],
      techSavviness: 5,
      quote: 'I need a reason to care in the first minute or I am already half gone.',
      signupTriggers: ['Instant clarity', 'Fast activation', 'Evidence that the product saves time'],
      bounceTriggers: ['Abstract copy', 'Delayed payoff', 'Bloated first-run experience'],
    },
    {
      name: 'Priya Nair',
      description: descriptionByMode,
      age: 39,
      jobTitle: 'Compliance Lead',
      companySize: '501-1000 employees',
      goals: ['Check whether risky actions are explained well', 'Confirm safeguards are visible', 'Avoid ambiguous flows that create policy problems'],
      frustrations: ['Missing disclosures', 'Weak permission language', 'Unclear auditability'],
      techSavviness: 3,
      quote: 'If the system asks me to trust it without proof, I slow down immediately.',
      signupTriggers: ['Transparent rules', 'Trustworthy controls', 'Clear accountability'],
      bounceTriggers: ['Hidden consequences', 'Ambiguous approvals', 'Missing policy cues'],
    },
    {
      name: 'Leo Martinez',
      description: descriptionByMode,
      age: 27,
      jobTitle: 'Sales Manager',
      companySize: '51-200 employees',
      goals: ['Move through the flow fast', 'Find the fastest path to value', 'Judge whether the product feels polished enough to demo'],
      frustrations: ['Slow navigation', 'Confusing labels', 'Anything that interrupts momentum'],
      techSavviness: 4,
      quote: 'Every extra click feels like resistance I will have to explain later.',
      signupTriggers: ['Fast path forward', 'Strong demo readiness', 'Clear momentum'],
      bounceTriggers: ['Hidden actions', 'Laggy-feeling flow', 'Uncertain next steps'],
    },
    {
      name: 'Grace Okafor',
      description: descriptionByMode,
      age: 44,
      jobTitle: 'IT Administrator',
      companySize: '1000+ employees',
      goals: ['Assess operational reliability', 'Check role and setup clarity', 'Understand how safely the product fits an existing stack'],
      frustrations: ['Vague setup requirements', 'Unclear permissions', 'Unpredictable system behavior'],
      techSavviness: 4,
      quote: 'I need confidence that this product behaves predictably before I let anyone rely on it.',
      signupTriggers: ['Clear setup rules', 'Visible safeguards', 'Operational clarity'],
      bounceTriggers: ['Loose configuration language', 'Unclear control boundaries', 'Fragile-looking workflows'],
    },
    {
      name: 'Sofia Ramirez',
      description: descriptionByMode,
      age: 33,
      jobTitle: 'Marketing Operations Lead',
      companySize: '201-500 employees',
      goals: ['Understand how the product fits a daily workflow', 'Judge whether the UX feels teachable', 'Spot places where teams would hesitate'],
      frustrations: ['Disconnected flow logic', 'Weak hierarchy', 'Missing handoff cues'],
      techSavviness: 4,
      quote: 'If I cannot picture how my team would adopt this, the experience is still too fuzzy.',
      signupTriggers: ['Workflow clarity', 'Confident copy', 'Easy handoff moments'],
      bounceTriggers: ['Scattered flow', 'Too many mental jumps', 'Weak role fit'],
    },
    {
      name: 'Ethan Walker',
      description: descriptionByMode,
      age: 35,
      jobTitle: 'Accessibility Advocate',
      companySize: '11-50 employees',
      goals: ['Notice where clarity breaks down', 'Check whether the interface feels inclusive', 'Find interaction patterns that create avoidable friction'],
      frustrations: ['Weak accessibility cues', 'Poor contrast or labeling', 'Interaction patterns that assume too much'],
      techSavviness: 5,
      quote: 'If the interface only works for the happy path, it is not really working.',
      signupTriggers: ['Inclusive design signals', 'Readable structure', 'Clear interaction affordances'],
      bounceTriggers: ['Ambiguous labels', 'Low accessibility confidence', 'Needless complexity'],
    },
  ];

  return assignPersonaIds(
    fallbackPersonas.slice(0, normalizePersonaCount(personaCount))
  );
}

function normalizePersonaCount(personaCount?: number) {
  if (typeof personaCount !== 'number' || !Number.isFinite(personaCount)) {
    return 3;
  }

  return Math.max(3, Math.min(10, Math.round(personaCount)));
}

function assignPersonaIds(personas: Persona[]): GeneratedPersona[] {
  const usedIds = new Set<string>();

  return personas.map((persona, index) => {
    const baseId = slugifyPersonaName(persona.name) || `persona-${index + 1}`;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);

    return {
      ...persona,
      id,
    };
  });
}

function slugifyPersonaName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeChatAgentResponse(response: ChatAgentResponse): ChatAgentResponse {
  return {
    assistantMessage:
      response.assistantMessage?.trim() ||
      'I need a bit more context to coach this product effectively.',
    recommendedTestIds: normalizeRecommendedTestIds(response.recommendedTestIds),
    intakeUpdates: normalizeStructuredIntakeUpdate(response.intakeUpdates),
    checklistItems: normalizeStringList(response.checklistItems),
    insightHighlights: normalizeStringList(response.insightHighlights),
    nextAction: response.nextAction?.trim() || undefined,
    mode: normalizeChatMode(response.mode),
  };
}

function normalizeAnalysisResult(
  analysis: UXAnalysis,
  selectedTestIds?: ValidationTestId[],
  browserExplorationSummary?: BrowserExplorationSummary
): UXAnalysis {
  return {
    ...analysis,
    selectedTestResults: normalizeSelectedTestResults(
      analysis.selectedTestResults,
      selectedTestIds,
      browserExplorationSummary
    ),
  };
}

function normalizeSelectedTestResults(
  selectedTestResults: ValidationTestResult[] | undefined,
  selectedTestIds?: ValidationTestId[],
  browserExplorationSummary?: BrowserExplorationSummary
): ValidationTestResult[] {
  if (!selectedTestIds || selectedTestIds.length === 0) {
    return [];
  }

  const resultsById = new Map(
    (selectedTestResults || []).map((result) => [result.id, result])
  );

  return selectedTestIds.map((id) => {
    const catalogItem = VALIDATION_TEST_CATALOG.find((test) => test.id === id);
    const result = resultsById.get(id);
    const fallback = buildMissingTestResultFallback({
      browserExplorationSummary,
      label: catalogItem?.label || id,
      testId: id,
    });

    return {
      id,
      label: result?.label?.trim() || catalogItem?.label || id,
      score: clampScore(result?.score),
      summary:
        result?.summary?.trim() ||
        fallback.summary,
      quotes: normalizeResultQuotes(
        result?.quotes || fallback.quotes,
        `${catalogItem?.label.toLowerCase() || id} test`
      ),
      actionableChanges: normalizeActionableChanges(
        result?.actionableChanges || fallback.actionableChanges,
        `${catalogItem?.label.toLowerCase() || id} test`
      ),
      keyInsights: normalizeNarrativeInsights(
        result?.keyInsights || fallback.keyInsights,
        `${catalogItem?.label.toLowerCase() || id} test`
      ),
      keyFindings: normalizeStringList(result?.keyFindings),
      recommendations: normalizeStringList(result?.recommendations),
      wentWell: normalizeStringList(result?.wentWell),
      needsChange: normalizeStringList(result?.needsChange),
      shouldEliminate: normalizeStringList(result?.shouldEliminate),
    };
  });
}

function normalizeStringList(items: string[] | undefined) {
  return (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

function normalizeResultQuotes(
  quotes: ResultQuotes | undefined,
  contextLabel: string
): ResultQuotes {
  return {
    positive:
      quotes?.positive?.trim() ||
      `I found at least one part of this ${contextLabel} that felt promising.`,
    negative:
      quotes?.negative?.trim() ||
      `I still hit a frustrating moment in this ${contextLabel} that needs attention.`,
  };
}

function normalizeActionableChanges(
  actionableChanges: ResultActionableChange[] | undefined,
  contextLabel: string
): ResultActionableChange[] {
  const normalizedByPriority = new Map<ResultActionPriority, string>();

  (actionableChanges || []).forEach((change) => {
    const priority = change?.priority;
    const text = change?.text?.trim();

    if (
      priority &&
      ACTIONABLE_CHANGE_PRIORITIES.includes(priority) &&
      text &&
      !normalizedByPriority.has(priority)
    ) {
      normalizedByPriority.set(priority, text);
    }
  });

  return ACTIONABLE_CHANGE_PRIORITIES.map((priority) => ({
    priority,
    text:
      normalizedByPriority.get(priority) ||
      buildActionableChangeFallback(priority, contextLabel),
  }));
}

function normalizeNarrativeInsights(
  keyInsights: string[] | undefined,
  contextLabel: string
) {
  const normalized = normalizeStringList(keyInsights);

  while (normalized.length < 3) {
    normalized.push(
      `A clearer ${INSIGHT_ORDINAL_LABELS[normalized.length]} insight was not returned for this ${contextLabel}.`
    );
  }

  return normalized.slice(0, 3);
}

function buildActionableChangeFallback(
  priority: ResultActionPriority,
  contextLabel: string
) {
  switch (priority) {
    case 'urgent':
      return `Clarify the biggest blocker in this ${contextLabel} immediately.`;
    case 'important':
      return `Refine the next most important friction point in this ${contextLabel}.`;
    case 'later':
      return `Polish the lower-priority rough edges in this ${contextLabel} after the core fix lands.`;
    default:
      return `Refine this ${contextLabel} based on the strongest persona signal.`;
  }
}

function capitalizePriority(priority: ResultActionPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function buildMissingTestResultFallback({
  browserExplorationSummary,
  label,
  testId,
}: {
  browserExplorationSummary?: BrowserExplorationSummary;
  label: string;
  testId: ValidationTestId;
}) {
  const attempt = browserExplorationSummary?.attempts.find(
    (entry) => entry.testId === testId
  );
  const objective = browserExplorationSummary?.objectives.find(
    (entry) => entry.testId === testId
  );
  const lowerLabel = label.toLowerCase();
  const observation = attempt?.observation?.trim();
  const focus = objective?.observationFocus?.trim();
  const shadowDomBlocked = /shadow dom/i.test(observation || '');

  const summary =
    attempt?.status === 'attempted'
      ? `The automated ${lowerLabel} review hit an interaction blocker, so this test is using fallback evidence from the visible screen instead. ${observation || ''}`.trim()
      : attempt?.status === 'failed'
        ? `The automated ${lowerLabel} review failed before structured evidence could be gathered. ${observation || ''}`.trim()
        : attempt?.status === 'not_found'
          ? `No obvious ${lowerLabel} surface was found during browser exploration, so this test is relying on the broader visible screens that were captured.`
          : `No explicit ${lowerLabel} summary was returned, so this test is relying on the captured evidence that was available.`;

  return {
    summary,
    quotes: {
      positive:
        attempt?.status === 'attempted' || attempt?.status === 'completed'
          ? `I could still judge some visible ${lowerLabel} cues from the screen that was captured.`
          : `I could still infer a few visible ${lowerLabel} cues from the broader experience.`,
      negative: shadowDomBlocked
        ? `I got blocked when an important ${lowerLabel} interaction lived inside a shadow DOM.`
        : attempt?.status === 'not_found'
          ? `I couldn't find an obvious ${lowerLabel} path to inspect in the product.`
          : `I still ran into a frustrating gap while trying to evaluate this ${lowerLabel} flow.`,
    },
    actionableChanges: [
      {
        priority: 'urgent' as const,
        text: shadowDomBlocked
          ? `Expose the key ${lowerLabel} interaction outside the shadow DOM or provide a stable trigger so the flow can be reached reliably.`
          : `Make the primary ${lowerLabel} path easier to reach and evaluate from the main product surface.`,
      },
      {
        priority: 'important' as const,
        text: focus
          ? `Strengthen the visible ${focus.toLowerCase()} so the review surface is clearer even before deeper interaction.`
          : `Clarify the visible labels, instructions, and states tied to this ${lowerLabel} flow.`,
      },
      {
        priority: 'later' as const,
        text: `Add stronger instrumentation or review-friendly cues so future ${lowerLabel} checks can verify this flow faster.`,
      },
    ],
    keyInsights: [
      attempt?.status === 'attempted'
        ? `The intended ${lowerLabel} interaction was only partially reachable, so the report is based on fallback evidence from the visible page.`
        : attempt?.status === 'not_found'
          ? `The browser session did not discover an obvious ${lowerLabel} entry point to inspect.`
          : `The model did not return a dedicated ${lowerLabel} result, so this section is using the captured run context.`,
      focus
        ? `The review was trying to inspect ${focus.toLowerCase()}.`
        : `This review still centered on the most visible ${lowerLabel} cues in the captured screens.`,
      shadowDomBlocked
        ? 'A shadow DOM boundary blocked direct interaction, which reduced the amount of structured evidence available for this test.'
        : 'Additional direct evidence from the target flow would make this test result more specific on the next run.',
    ],
  };
}

function normalizeRecommendedTestIds(
  recommendedTestIds?: ValidationTestId[]
): ValidationTestId[] | undefined {
  const normalized = (recommendedTestIds || []).filter((testId) =>
    VALIDATION_TEST_CATALOG.some((test) => test.id === testId)
  );

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeStructuredIntakeUpdate(
  intakeUpdates?: StructuredIntakeUpdate
): StructuredIntakeUpdate | undefined {
  if (!intakeUpdates) {
    return undefined;
  }

  const normalized: StructuredIntakeUpdate = {};

  if (intakeUpdates.productSummary?.trim()) {
    normalized.productSummary = intakeUpdates.productSummary.trim();
  }

  if (intakeUpdates.targetAudience?.trim()) {
    normalized.targetAudience = intakeUpdates.targetAudience.trim();
  }

  if (intakeUpdates.additionalNotes?.trim()) {
    normalized.additionalNotes = intakeUpdates.additionalNotes.trim();
  }

  const listFields: Array<keyof Pick<
    StructuredIntakeContext,
    | 'audienceNeeds'
    | 'keyFlowsOrJobs'
    | 'onboardingConcerns'
    | 'engagementConcerns'
    | 'accessibilityConcerns'
    | 'complianceConcerns'
  >> = [
    'audienceNeeds',
    'keyFlowsOrJobs',
    'onboardingConcerns',
    'engagementConcerns',
    'accessibilityConcerns',
    'complianceConcerns',
  ];

  listFields.forEach((field) => {
    const values = normalizeStringList(intakeUpdates[field]);

    if (values.length > 0) {
      normalized[field] = values;
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeChatMode(mode?: ChatAgentResponse['mode']) {
  if (!mode) {
    return undefined;
  }

  return ['intake', 'coaching', 'analysis', 'action'].includes(mode)
    ? mode
    : undefined;
}

function clampScore(score?: number) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

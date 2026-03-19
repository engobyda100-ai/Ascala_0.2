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
  Persona,
  ReviewAttachedFileMetadata,
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
  ANALYSIS_PROMPT,
  INTAKE_CHAT_PROMPT,
} from './prompts';

interface ReviewContextOptions {
  attachedFiles?: ReviewAttachedFileMetadata[];
  browserExplorationSummary?: BrowserExplorationSummary;
  intakeSummary?: string;
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

    const prompt = PERSONA_PROMPT
      .replace('{{TARGET_MARKET}}', targetMarket)
      .replace('{{PRODUCT_CONTEXT}}', formatOptionalText(options.productContext))
      .replace('{{STRUCTURED_INTAKE}}', formatStructuredIntake(options.structuredIntake))
      .replace('{{INTAKE_SUMMARY}}', formatOptionalText(options.intakeSummary))
      .replace('{{SELECTED_TESTS}}', formatSelectedTests(options.selectedTestIds))
      .replace('{{ATTACHED_FILES}}', formatAttachedFiles(options.attachedFiles))
      .replace(
        '{{ATTACHED_FILE_CONTEXT}}',
        formatAttachedFileContext(options.attachedFiles)
      );
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
      options.selectedTestIds
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
    latestResultsSummary.topFindings.length > 0
      ? `Top findings:\n- ${latestResultsSummary.topFindings
          .map((item) => `${item.title}: ${item.detail}`)
          .join('\n- ')}`
      : '',
    latestResultsSummary.topRecommendations.length > 0
      ? `Top recommendations:\n- ${latestResultsSummary.topRecommendations
          .map((item) => `${item.title}: ${item.detail}`)
          .join('\n- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatStructuredField(label: string, value?: string) {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : '';
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
      const findings = test.keyFindings.length
        ? `Findings: ${test.keyFindings.join(' | ')}`
        : 'Findings: none yet';
      const recommendations = test.recommendations.length
        ? `Recommendations: ${test.recommendations.join(' | ')}`
        : 'Recommendations: none yet';

      return `${test.label} (${test.id}) [${test.status}] ${
        typeof test.score === 'number' ? `${test.score}/100` : 'pending'
      }\nSummary: ${test.summary}\n${findings}\n${recommendations}`;
    })
    .join('\n\n');
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
  selectedTestIds?: ValidationTestId[]
): UXAnalysis {
  return {
    ...analysis,
    selectedTestResults: normalizeSelectedTestResults(
      analysis.selectedTestResults,
      selectedTestIds
    ),
  };
}

function normalizeSelectedTestResults(
  selectedTestResults: ValidationTestResult[] | undefined,
  selectedTestIds?: ValidationTestId[]
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

    return {
      id,
      label: result?.label?.trim() || catalogItem?.label || id,
      score: clampScore(result?.score),
      summary:
        result?.summary?.trim() ||
        `No explicit ${catalogItem?.label.toLowerCase() || id} summary was returned.`,
      keyFindings: normalizeStringList(result?.keyFindings),
      recommendations: normalizeStringList(result?.recommendations),
    };
  });
}

function normalizeStringList(items: string[] | undefined) {
  return (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
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

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleUserRound, Settings, Share2 } from 'lucide-react';
import { AssetsPanel } from '@/components/intake/AssetsPanel';
import { AgentChatPanel } from '@/components/intake/AgentChatPanel';
import {
  ExpandedResultsReaderSurface,
  getPreferredResultTest,
  ResultsPanel,
  TestReportReaderOverlay,
} from '@/components/intake/ResultsPanel';
import { ValidationPanel } from '@/components/intake/ValidationPanel';
import type {
  BrowserExplorationSummary,
  ChatAgentRequest,
  ChatAgentResponse,
  ChatAgentMode,
  InputMode,
  IntakeChatMessage,
  IntakeCoachMessagePayload,
  ReviewAttachedFileMetadata,
  ReviewRequest,
  StructuredIntakeContext,
  StructuredIntakeUpdate,
  UploadFilesResponse,
  UploadedContextFile,
  UXReport,
  ValidationResultTestSummary,
  ValidationProgressStep,
  ValidationResultSummary,
  ValidationTestId,
  ValidationTestGroup,
  WorkspaceRunState,
} from '@/lib/types';
import { VALIDATION_TEST_CATALOG } from '@/lib/types';

const VALIDATION_STAGES = [
  'Preparing the current validation suite...',
  'Generating the target persona...',
  'Running the browser walkthrough...',
  'Capturing page context and screenshots...',
  'Analyzing UX findings and recommendations...',
] as const;

const VALIDATION_TEST_GROUPS: ValidationTestGroup[] = [
  {
    id: 'selected-validation-tests',
    label: 'Choose tests to run',
    tests: VALIDATION_TEST_CATALOG,
  },
];

const INITIAL_SELECTED_TEST_IDS = [] as const satisfies readonly ValidationTestId[];

const INITIAL_MESSAGES: IntakeChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content:
      "Most products don't fail after launch, they fail before it. Drop your prototype and context on the left, then pick what you want tested (or let me recommend). I'll show you where it breaks, and what to fix in minutes!",
    timestamp: createChatTimestamp(),
  },
];

export function IntakeWorkspace() {
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [appUrl, setAppUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [messages, setMessages] = useState<IntakeChatMessage[]>(INITIAL_MESSAGES);
  const messagesRef = useRef<IntakeChatMessage[]>(INITIAL_MESSAGES);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedContextFile[]>([]);
  const [chatMode, setChatMode] = useState<ChatAgentMode>('intake');
  const [recommendedTestIds, setRecommendedTestIds] = useState<ValidationTestId[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checkedChecklistItems, setCheckedChecklistItems] = useState<string[]>([]);
  const [insightHighlights, setInsightHighlights] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [intakeUpdates, setIntakeUpdates] = useState<StructuredIntakeUpdate>({});
  const [isChatResponding, setIsChatResponding] = useState(false);
  const [latestBrowserExplorationSummary, setLatestBrowserExplorationSummary] =
    useState<BrowserExplorationSummary | null>(null);
  const [selectedTestIds, setSelectedTestIds] = useState<ValidationTestId[]>(
    Array.from(INITIAL_SELECTED_TEST_IDS)
  );
  const [completedResultsById, setCompletedResultsById] = useState<
    Partial<Record<ValidationTestId, ValidationResultTestSummary>>
  >({});
  const [resultSnapshot, setResultSnapshot] = useState<
    Omit<ValidationResultSummary, 'selectedTests'> | null
  >(null);
  const [runState, setRunState] = useState<WorkspaceRunState>({ status: 'idle' });
  const [stageIndex, setStageIndex] = useState(0);
  const [activeResultTestId, setActiveResultTestId] = useState<
    ValidationResultTestSummary['id'] | null
  >(null);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);
  const [isExpandedResultsOpen, setIsExpandedResultsOpen] = useState(false);
  const structuredIntake = useMemo(
    () =>
      mergeStructuredIntakeContext(
        deriveStructuredIntakeContext({
          appUrl: getActiveTextTarget(inputMode, appUrl, figmaUrl),
          messages,
          selectedTestIds,
          uploadedFiles,
        }),
        intakeUpdates
      ),
    [appUrl, figmaUrl, inputMode, intakeUpdates, messages, selectedTestIds, uploadedFiles]
  );
  const intakeSignalCount = countStructuredIntakeSignals(structuredIntake);
  const completedSelectedTestIds = useMemo(
    () => selectedTestIds.filter((testId) => Boolean(completedResultsById[testId])),
    [completedResultsById, selectedTestIds]
  );
  const pendingTestIds = useMemo(() => selectedTestIds, [selectedTestIds]);
  const resultSummary = useMemo(
    () =>
      buildResultSummary({
        completedResultsById,
        pendingTestIds,
        resultSnapshot,
      }),
    [completedResultsById, pendingTestIds, resultSnapshot]
  );
  const resultTests = useMemo<ValidationResultTestSummary[]>(
    () => resultSummary?.selectedTests ?? [],
    [resultSummary]
  );
  const preferredResultTest = useMemo(
    () => getPreferredResultTest(resultTests),
    [resultTests]
  );
  const activeResultTest =
    resultTests.find((test) => test.id === activeResultTestId) ||
    preferredResultTest ||
    null;
  const completedResultTests = useMemo(
    () => resultTests.filter((test) => test.status === 'completed'),
    [resultTests]
  );

  const canRun =
    hasValidInput({
      appUrl,
      figmaUrl,
      inputMode,
      screenshots,
      videos,
    }) &&
    pendingTestIds.length > 0 &&
    runState.status !== 'running';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!resultSummary) {
      setActiveResultTestId(null);
      setIsResultPopupOpen(false);
      setIsExpandedResultsOpen(false);
      return;
    }

    if (
      activeResultTestId &&
      resultSummary.selectedTests.some((test) => test.id === activeResultTestId)
    ) {
      return;
    }

    setActiveResultTestId(preferredResultTest?.id || null);
  }, [activeResultTestId, preferredResultTest, resultSummary]);

  useEffect(() => {
    if (runState.status === 'success') {
      return;
    }

    setIsResultPopupOpen(false);
    setIsExpandedResultsOpen(false);
  }, [runState.status]);

  const handleAddFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const incomingFiles = fileList.map((file) => createPendingUploadedFile(file));

    setUploadedFiles((current) => mergeUploadedFiles(current, incomingFiles));

    const formData = new FormData();

    fileList.forEach((file, index) => {
      formData.append('files', file);
      formData.append('clientFileIds', incomingFiles[index].id);
    });

    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as UploadFilesResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'File upload failed');
      }

      setUploadedFiles((current) => mergeUploadedFiles(current, data.files));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'File upload failed unexpectedly.';

      setUploadedFiles((current) =>
        current.map((file) =>
          incomingFiles.some((incomingFile) => incomingFile.id === file.id)
            ? {
                ...file,
                ingestionStatus: 'error',
                ingestionError: message,
              }
            : file
        )
      );
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((current) => current.filter((file) => file.id !== fileId));
  };

  const handleToggleValidationTest = (testId: ValidationTestId) => {
    setSelectedTestIds((current) =>
      current.includes(testId)
        ? current.filter((id) => id !== testId)
        : [...current, testId]
    );
  };

  const handleInputModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setRunState((current) => (current.status === 'error' ? { status: 'idle' } : current));
  };

  const handleAddScreenshots = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

    if (nextFiles.length === 0) {
      return;
    }

    setScreenshots((current) => [...current, ...nextFiles]);
  };

  const handleRemoveScreenshot = (indexToRemove: number) => {
    setScreenshots((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleAddVideos = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('video/'));

    if (nextFiles.length === 0) {
      return;
    }

    setVideos((current) => [...current, ...nextFiles]);
  };

  const handleRemoveVideo = (indexToRemove: number) => {
    setVideos((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const appendMessage = (message: IntakeChatMessage) => {
    setMessages((current) => {
      const nextMessages = [...current, message];
      messagesRef.current = nextMessages;
      return nextMessages;
    });
  };

  const appendAssistantMessage = (
    content: string,
    prefix = 'assistant',
    coachPayload?: IntakeCoachMessagePayload
  ) => {
    appendMessage({
      id: `${prefix}-${Date.now()}`,
      role: 'assistant',
      content,
      coachPayload,
      timestamp: createChatTimestamp(),
    });
  };

  const applyCoachResponse = (response: ChatAgentResponse) => {
    setChatMode(response.mode || 'coaching');
    if (response.recommendedTestIds) {
      setRecommendedTestIds(response.recommendedTestIds);
    }
    if (response.checklistItems) {
      setChecklistItems(response.checklistItems);
      setCheckedChecklistItems((current) =>
        current.filter((item) => response.checklistItems?.includes(item))
      );
    }
    if (response.insightHighlights) {
      setInsightHighlights(response.insightHighlights);
    }
    if (typeof response.nextAction !== 'undefined') {
      setNextAction(response.nextAction || null);
    }

    if (response.intakeUpdates) {
      setIntakeUpdates((current) =>
        mergeStructuredIntakeUpdateState(current, response.intakeUpdates)
      );
    }
  };

  const handleApplyRecommendedTests = (testIds: ValidationTestId[]) => {
    if (testIds.length === 0) {
      return;
    }

    setSelectedTestIds((current) =>
      Array.from(new Set([...current, ...testIds]))
    );
  };

  const handleToggleChecklistItem = (item: string) => {
    setCheckedChecklistItems((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item]
    );
  };

  const fetchCoachResponse = async (request: ChatAgentRequest) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = (await response.json()) as ChatAgentResponse & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Chat failed');
    }

    return data;
  };

  const handleSendMessage = async () => {
    const trimmed = draftMessage.trim();

    if (!trimmed || isChatResponding) {
      return;
    }

    const userMessage: IntakeChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: createChatTimestamp(),
    };

    const nextMessages = [...messagesRef.current, userMessage];
    const nextStructuredIntake = mergeStructuredIntakeContext(
      deriveStructuredIntakeContext({
        appUrl: getActiveTextTarget(inputMode, appUrl, figmaUrl),
        messages: nextMessages,
        selectedTestIds,
        uploadedFiles,
      }),
      intakeUpdates
    );

    appendMessage(userMessage);
    setDraftMessage('');
    setIsChatResponding(true);

    try {
      const response = await fetchCoachResponse({
        attachedFiles: mapAttachedFiles(uploadedFiles),
        browserExplorationSummary: latestBrowserExplorationSummary || undefined,
        currentStage: VALIDATION_STAGES[stageIndex],
        latestResultsSummary: resultSummary,
        recentMessages: getRecentMessages(nextMessages),
        runState,
        selectedTestIds,
        selectedTestResults: completedResultTests,
        structuredIntake: nextStructuredIntake,
        trigger: 'message',
      });

      applyCoachResponse(response);
      appendAssistantMessage(
        response.assistantMessage,
        'assistant-coach',
        createCoachMessagePayload(response)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Chat failed unexpectedly.';

      appendAssistantMessage(
        `I hit a problem reaching the intake coach just now. Keep adding product context and I’ll continue once the chat route is available again. Details: ${message}`,
        'assistant-chat-error'
      );
    } finally {
      setIsChatResponding(false);
    }
  };

  const handleRunValidation = async () => {
    const inputError = getInputValidationError({
      appUrl,
      figmaUrl,
      inputMode,
      screenshots,
      videos,
    });

    if (inputError) {
      const error = inputError;

      setRunState({ status: 'error', error });
      appendAssistantMessage(error, 'assistant-blocked');
      return;
    }

    if (selectedTestIds.length === 0) {
      const error = 'Select at least one validation test before running the suite.';

      setRunState({ status: 'error', error });
      return;
    }

    setRunState({ status: 'running' });
    setStageIndex(0);

    const payload = await buildReviewRequest({
      appUrl,
      figmaUrl,
      inputMode,
      messages,
      screenshots,
      videos,
      selectedTestIds: pendingTestIds,
      structuredIntake,
      uploadedFiles,
    });

    const progressInterval = window.setInterval(() => {
      setStageIndex((current) =>
        current >= VALIDATION_STAGES.length - 1 ? current : current + 1
      );
    }, 2500);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Review failed');
      }

      const latestSummary = mapReportToResultSummary(data as UXReport);
      const mergedCompletedResults = mergeCompletedResults(
        completedResultsById,
        latestSummary.selectedTests
      );
      const nextPendingTestIds: ValidationTestId[] = [];
      const nextResultSnapshot = buildResultSnapshot({
        completedResultsById: mergedCompletedResults,
        latestSummary,
      });
      const mergedResultSummary = buildResultSummary({
        completedResultsById: mergedCompletedResults,
        pendingTestIds: nextPendingTestIds,
        resultSnapshot: nextResultSnapshot,
      });
      const browserExplorationSummary =
        (data as UXReport).browserExplorationSummary || null;
      const pipelineNotice = (data as UXReport).pipelineNotice;
      const completedTestsForCoach = mergedResultSummary?.selectedTests.filter(
        (test) => test.status === 'completed'
      );
      const lastRunAt = createRunTimestamp();

      setStageIndex(VALIDATION_STAGES.length - 1);
      setCompletedResultsById(mergedCompletedResults);
      setSelectedTestIds([]);
      setResultSnapshot(nextResultSnapshot);
      setLatestBrowserExplorationSummary(browserExplorationSummary);
      setRunState({
        status: 'success',
        lastRunAt,
      });

      if (pipelineNotice) {
        appendAssistantMessage(pipelineNotice, 'assistant-pipeline-notice');
      }

      setIsChatResponding(true);

      try {
        const response = await fetchCoachResponse({
          attachedFiles: mapAttachedFiles(uploadedFiles),
          browserExplorationSummary: browserExplorationSummary || undefined,
          currentStage: VALIDATION_STAGES[VALIDATION_STAGES.length - 1],
          latestResultsSummary: mergedResultSummary,
          recentMessages: getRecentMessages(messagesRef.current),
          runState: {
            status: 'success',
            lastRunAt,
          },
          selectedTestIds,
          selectedTestResults: completedTestsForCoach,
          structuredIntake,
          trigger: 'post-run',
        });

        applyCoachResponse(response);
        appendAssistantMessage(
          response.assistantMessage,
          'assistant-post-run',
          createCoachMessagePayload(response)
        );
      } catch {
        appendAssistantMessage(
          'Validation finished successfully. The latest output summary is now available in the Results panel.',
          'assistant-success'
        );
      } finally {
        setIsChatResponding(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unknown validation error occurred.';

      setRunState({ status: 'error', error: message });
      appendAssistantMessage(`The validation suite hit an error: ${message}`, 'assistant-error');
    } finally {
      window.clearInterval(progressInterval);
    }
  };

  const progressSteps = createProgressSteps(runState.status, stageIndex);

  const handleOpenResultTestReport = (testId: ValidationResultTestSummary['id']) => {
    setActiveResultTestId(testId);
    setIsExpandedResultsOpen(false);
    setIsResultPopupOpen(true);
  };

  const handleOpenExpandedResults = () => {
    if (preferredResultTest) {
      setActiveResultTestId(preferredResultTest.id);
    }

    setIsResultPopupOpen(false);
    setIsExpandedResultsOpen(true);
  };

  return (
    <div className="h-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <header className="relative rounded-2xl bg-white/45 px-4 py-2 shadow-[0_20px_48px_-26px_rgba(61,23,0,0.34)] backdrop-blur-sm sm:px-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Image
                alt="Ascala"
                className="h-10 w-auto object-contain sm:h-12"
                height={84}
                priority
                src="/ascala-logo.png"
                width={358}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-medium transition-colors hover:bg-background/70"
              >
                <Share2 className="h-3.5 w-3.5 text-[#C26A43]" />
                <span>Share</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-medium transition-colors hover:bg-background/70"
              >
                <Settings className="h-3.5 w-3.5 text-[#C26A43]" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-medium transition-colors hover:bg-background/70"
              >
                <CircleUserRound className="h-3.5 w-3.5 text-[#C26A43]" />
                <span>Account</span>
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-6 -bottom-4 h-6 bg-gradient-to-b from-[rgba(61,23,0,0.14)] via-[rgba(61,23,0,0.05)] to-transparent blur-md" />
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[216px_minmax(0,1.7fr)_388px] 2xl:grid-cols-[224px_minmax(0,1.85fr)_408px]">
            <div className="min-h-0">
              <AssetsPanel
                appUrl={appUrl}
                figmaUrl={figmaUrl}
                inputMode={inputMode}
                screenshots={screenshots}
                videos={videos}
                uploadedFiles={uploadedFiles}
                onAppUrlChange={setAppUrl}
                onFigmaUrlChange={setFigmaUrl}
                onInputModeChange={handleInputModeChange}
                onAddScreenshots={handleAddScreenshots}
                onRemoveScreenshot={handleRemoveScreenshot}
                onAddVideos={handleAddVideos}
                onRemoveVideo={handleRemoveVideo}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
              />
            </div>

            <div className="min-h-0">
              <AgentChatPanel
                checkedChecklistItems={checkedChecklistItems}
                intakeSignalCount={intakeSignalCount}
                draftMessage={draftMessage}
                isResponding={isChatResponding}
                messages={messages}
                mode={chatMode}
                onApplyRecommendedTests={handleApplyRecommendedTests}
                onDraftChange={setDraftMessage}
                onSendMessage={handleSendMessage}
                onToggleChecklistItem={handleToggleChecklistItem}
                selectedTestIds={selectedTestIds}
              />
            </div>

            <div className="min-h-0 rounded-[22px] border border-border/40 bg-white/48 shadow-[0_28px_70px_-32px_rgba(68,48,29,0.72)] backdrop-blur-sm">
              <div className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 basis-[60%] border-b border-border/40">
                  <ValidationPanel
                    completedTestIds={completedSelectedTestIds}
                    currentStage={VALIDATION_STAGES[stageIndex]}
                    groups={VALIDATION_TEST_GROUPS}
                    pendingTestIds={pendingTestIds}
                    selectedTestIds={selectedTestIds}
                    runState={runState}
                    canRun={canRun}
                    onRun={handleRunValidation}
                    onToggleTest={handleToggleValidationTest}
                  />
                </div>
                <div className="min-h-0 basis-[40%]">
                  <ResultsPanel
                    onOpenExpandedReader={handleOpenExpandedResults}
                    onOpenTestReport={handleOpenResultTestReport}
                    progressSteps={progressSteps}
                    resultSummary={resultSummary}
                    runState={runState}
                  />
                </div>
              </div>
            </div>
          </div>

          {isExpandedResultsOpen && resultSummary && activeResultTest ? (
            <div className="absolute inset-y-0 left-0 right-0 z-40 xl:left-[calc(216px+0.75rem)] 2xl:left-[calc(224px+0.75rem)]">
              <div
                className="absolute inset-0 rounded-[28px] bg-[rgba(45,33,22,0.18)]"
                onClick={() => setIsExpandedResultsOpen(false)}
              />
              <div className="absolute inset-0 p-3 sm:p-5">
                <ExpandedResultsReaderSurface
                  activeTest={activeResultTest}
                  onClose={() => setIsExpandedResultsOpen(false)}
                  onSelectTest={setActiveResultTestId}
                  resultSummary={resultSummary}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isResultPopupOpen && activeResultTest ? (
        <TestReportReaderOverlay
          onClose={() => setIsResultPopupOpen(false)}
          test={activeResultTest}
        />
      ) : null}
    </div>
  );
}

function createChatTimestamp() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function createRunTimestamp() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function createCoachMessagePayload(
  response: ChatAgentResponse
): IntakeCoachMessagePayload | undefined {
  const payload: IntakeCoachMessagePayload = {};

  if (response.nextAction?.trim()) {
    payload.nextAction = response.nextAction.trim();
  }

  if (response.recommendedTestIds?.length) {
    payload.recommendedTestIds = response.recommendedTestIds;
  }

  if (response.insightHighlights?.length) {
    payload.insightHighlights = response.insightHighlights;
  }

  if (response.checklistItems?.length) {
    payload.checklistItems = response.checklistItems;
  }

  if (response.mode) {
    payload.mode = response.mode;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}

function getRecentMessages(messages: IntakeChatMessage[], limit = 10) {
  return messages.slice(-limit);
}

function createProgressSteps(
  runStatus: WorkspaceRunState['status'],
  stageIndex: number
): ValidationProgressStep[] {
  return [
    {
      id: 'persona',
      label: 'Generating persona',
      status: getProgressStatus(runStatus, stageIndex, 0),
    },
    {
      id: 'browser',
      label: 'Running browser session',
      status: getProgressStatus(runStatus, stageIndex, 1),
    },
    {
      id: 'observations',
      label: 'Capturing observations',
      status: getProgressStatus(runStatus, stageIndex, 2),
    },
    {
      id: 'analysis',
      label: 'Analyzing report',
      status: getProgressStatus(runStatus, stageIndex, 3),
    },
  ];
}

function getProgressStatus(
  runStatus: WorkspaceRunState['status'],
  stageIndex: number,
  stepIndex: number
): ValidationProgressStep['status'] {
  if (runStatus === 'success') {
    return 'complete';
  }

  if (runStatus !== 'running') {
    return 'pending';
  }

  if (stepIndex < stageIndex) {
    return 'complete';
  }

  if (stepIndex === stageIndex) {
    return 'active';
  }

  return 'pending';
}

function buildReviewRequest({
  appUrl,
  figmaUrl,
  inputMode,
  messages,
  screenshots,
  videos,
  selectedTestIds,
  structuredIntake,
  uploadedFiles,
}: {
  appUrl: string;
  figmaUrl: string;
  inputMode: InputMode;
  messages: IntakeChatMessage[];
  screenshots: File[];
  videos: File[];
  selectedTestIds: ValidationTestId[];
  structuredIntake: StructuredIntakeContext;
  uploadedFiles: UploadedContextFile[];
}): Promise<ReviewRequest> {
  return buildReviewRequestPayload({
    appUrl,
    figmaUrl,
    inputMode,
    messages,
    screenshots,
    videos,
    selectedTestIds,
    structuredIntake,
    uploadedFiles,
  });
}

async function buildReviewRequestPayload({
  appUrl,
  figmaUrl,
  inputMode,
  messages,
  screenshots,
  videos,
  selectedTestIds,
  structuredIntake,
  uploadedFiles,
}: {
  appUrl: string;
  figmaUrl: string;
  inputMode: InputMode;
  messages: IntakeChatMessage[];
  screenshots: File[];
  videos: File[];
  selectedTestIds: ValidationTestId[];
  structuredIntake: StructuredIntakeContext;
  uploadedFiles: UploadedContextFile[];
}): Promise<ReviewRequest> {
  const textTarget = getActiveTextTarget(inputMode, appUrl, figmaUrl).trim();
  const normalizedScreenshots =
    inputMode === 'screenshots'
      ? await Promise.all(screenshots.map(readFileAsDataUrl))
      : inputMode === 'video'
        ? await Promise.all(videos.map(readVideoFrameAsDataUrl))
        : undefined;
  const productContext = buildProductContext({
    appUrl: textTarget,
    inputMode,
    screenshotCount: inputMode === 'video' ? videos.length : screenshots.length,
    messages,
    structuredIntake,
    uploadedFiles,
  });
  const intakeSummary = buildIntakeSummary({
    messages,
    selectedTestIds,
    structuredIntake,
    uploadedFiles,
  });

  return {
    appUrl: textTarget,
    attachedFiles: mapAttachedFiles(uploadedFiles),
    figmaUrl: inputMode === 'figma' ? textTarget : undefined,
    intakeSummary,
    inputMode,
    productContext,
    screenshots: normalizedScreenshots,
    selectedTestIds,
    structuredIntake,
    targetMarket: buildReviewTargetMarket({
      appUrl: textTarget,
      inputMode,
      screenshotCount: inputMode === 'video' ? videos.length : screenshots.length,
      intakeSummary,
      productContext,
      structuredIntake,
    }),
  };
}

function buildReviewTargetMarket({
  appUrl,
  inputMode,
  screenshotCount,
  intakeSummary,
  productContext,
  structuredIntake,
}: {
  appUrl: string;
  inputMode: InputMode;
  screenshotCount: number;
  intakeSummary: string;
  productContext: string;
  structuredIntake: StructuredIntakeContext;
}) {
  const productLabel = getProductLabel(appUrl);
  const audienceSummary = structuredIntake.targetAudience
    ? `Target audience: ${structuredIntake.targetAudience}.`
    : '';
  const needsSummary =
    structuredIntake.audienceNeeds.length > 0
      ? `Audience needs: ${structuredIntake.audienceNeeds.join(', ')}.`
      : '';
  const sourceSummary =
    inputMode === 'figma'
      ? 'Source: Figma prototype link. Evaluate it as a simulation rather than a live navigable product.'
      : inputMode === 'screenshots'
        ? `Source: Uploaded screenshots only. ${screenshotCount} screenshot file(s) were selected.`
        : inputMode === 'video'
          ? `Source: Uploaded video files. ${screenshotCount} video file(s) were selected and sampled into static frames.`
        : 'Source: Live product URL.';

  return `Prospective users evaluating ${productLabel}. ${audienceSummary} ${needsSummary} ${sourceSummary} Product context: ${productContext} Intake summary: ${intakeSummary}`.trim();
}

function mapReportToResultSummary(report: UXReport): ValidationResultSummary {
  return {
    overallScore: calculateOverallScore(report),
    summary: report.personaVerdict,
    selectedTests: mapSelectedTestsForSummary(report),
    topFindings: report.findings.slice(0, 3).map((finding) => ({
      title: finding.category,
      detail: summarizeFinding(finding),
    })),
    topRecommendations: report.recommendations
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 3)
      .map((recommendation) => ({
        title: recommendation.whatToChange,
        detail: `${recommendation.whyItMatters} Expected impact: ${recommendation.expectedImpact}`,
      })),
  };
}

function mapSelectedTestsForSummary(report: UXReport): ValidationResultTestSummary[] {
  return report.selectedTestResults.map((testResult) => ({
    id: testResult.id,
    label: testResult.label,
    score: clampScore(testResult.score),
    summary: testResult.summary,
    keyFindings: testResult.keyFindings,
    recommendations: testResult.recommendations,
    wentWell: testResult.wentWell,
    needsChange: testResult.needsChange,
    shouldEliminate: testResult.shouldEliminate,
    status: 'completed',
  }));
}

function buildResultSummary({
  completedResultsById,
  pendingTestIds,
  resultSnapshot,
}: {
  completedResultsById: Partial<Record<ValidationTestId, ValidationResultTestSummary>>;
  pendingTestIds: ValidationTestId[];
  resultSnapshot: Omit<ValidationResultSummary, 'selectedTests'> | null;
}): ValidationResultSummary | null {
  const completedIds = Object.keys(completedResultsById) as ValidationTestId[];
  const visibleIds = VALIDATION_TEST_CATALOG.map((test) => test.id).filter(
    (testId) => completedIds.includes(testId) || pendingTestIds.includes(testId)
  );

  if (visibleIds.length === 0) {
    return null;
  }

  const selectedTests = visibleIds.map((testId) => {
    const completedResult = completedResultsById[testId];

    if (completedResult) {
      return completedResult;
    }

    return {
      id: testId,
      label: getValidationTestLabel(testId),
      summary: 'Pending run',
      keyFindings: [],
      recommendations: [],
      wentWell: [],
      needsChange: [],
      shouldEliminate: [],
      status: 'pending' as const,
    };
  });

  return {
    overallScore: resultSnapshot?.overallScore || calculateCompletedTestsAverageScore(completedResultsById),
    summary:
      resultSnapshot?.summary ||
      'Completed validation results are available below. Pending selections can be run incrementally.',
    topFindings: resultSnapshot?.topFindings || [],
    topRecommendations: resultSnapshot?.topRecommendations || [],
    selectedTests,
  };
}

function buildResultSnapshot({
  completedResultsById,
  latestSummary,
}: {
  completedResultsById: Partial<Record<ValidationTestId, ValidationResultTestSummary>>;
  latestSummary: ValidationResultSummary;
}): Omit<ValidationResultSummary, 'selectedTests'> {
  return {
    overallScore: calculateCompletedTestsAverageScore(completedResultsById),
    summary: latestSummary.summary,
    topFindings: latestSummary.topFindings,
    topRecommendations: latestSummary.topRecommendations,
  };
}

function mergeCompletedResults(
  current: Partial<Record<ValidationTestId, ValidationResultTestSummary>>,
  incoming: ValidationResultTestSummary[]
) {
  const merged = { ...current };

  incoming.forEach((test) => {
    merged[test.id] = {
      ...test,
      status: 'completed',
    };
  });

  return merged;
}

function summarizeFinding(reportFinding: UXReport['findings'][number]) {
  if (reportFinding.findings.length === 0) {
    return `${reportFinding.severity} severity finding.`;
  }

  return reportFinding.findings.slice(0, 2).join(' ');
}

function calculateOverallScore(report: UXReport) {
  const findingPenalty = report.findings.reduce((total, finding) => {
    if (finding.severity === 'Critical') {
      return total + 14;
    }

    if (finding.severity === 'Needs Work') {
      return total + 7;
    }

    return total + 1;
  }, 0);

  const metricAdjustment = report.metrics.reduce((total, metric) => {
    if (metric.rating === 'High') {
      return total + 4;
    }

    if (metric.rating === 'Low') {
      return total - 4;
    }

    return total;
  }, 0);

  return clampScore(78 - findingPenalty + metricAdjustment);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateCompletedTestsAverageScore(
  completedResultsById: Partial<Record<ValidationTestId, ValidationResultTestSummary>>
) {
  const completedResults = Object.values(completedResultsById).filter(
    (result): result is ValidationResultTestSummary =>
      Boolean(result && typeof result.score === 'number')
  );

  if (completedResults.length === 0) {
    return 0;
  }

  const total = completedResults.reduce(
    (sum, result) => sum + (result.score || 0),
    0
  );

  return clampScore(total / completedResults.length);
}

function buildProductContext({
  appUrl,
  inputMode,
  screenshotCount,
  messages,
  structuredIntake,
  uploadedFiles,
}: {
  appUrl: string;
  inputMode: InputMode;
  screenshotCount: number;
  messages: IntakeChatMessage[];
  structuredIntake: StructuredIntakeContext;
  uploadedFiles: UploadedContextFile[];
}) {
  const productLabel = getProductLabel(appUrl);
  const recentUserNotes = messages
    .filter((message) => message.role === 'user')
    .slice(-2)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join(' ');

  const attachedFileNames = uploadedFiles
    .slice(0, 5)
    .map((file) => file.name)
    .join(', ');
  const parsedFileSummaries = uploadedFiles
    .filter((file) => file.extractedText?.trim())
    .slice(0, 2)
    .map((file) => `${file.name}: ${file.extractedText?.slice(0, 220)}`)
    .join(' ');
  const sourceContext =
    inputMode === 'figma'
      ? `Primary source is a Figma prototype link: ${appUrl}. Treat interactions as simulated rather than live browser navigation.`
      : inputMode === 'screenshots'
        ? screenshotCount > 0
          ? `Primary source is ${screenshotCount} uploaded screenshot(s). Analyze them as static visual evidence rather than a live product session.`
          : 'Primary source is screenshot uploads, but no screenshot metadata was provided.'
        : inputMode === 'video'
          ? screenshotCount > 0
            ? `Primary source is ${screenshotCount} uploaded video file(s). Analyze sampled frames as a static approximation of the product journey.`
            : 'Primary source is video uploads, but no derived frames were available.'
        : `Primary source URL: ${appUrl}.`;

  const contextParts = [
    `Product target: ${productLabel}.`,
    sourceContext,
    structuredIntake.productSummary
      ? `Structured product summary: ${structuredIntake.productSummary}`
      : undefined,
    structuredIntake.targetAudience
      ? `Structured audience: ${structuredIntake.targetAudience}`
      : undefined,
    recentUserNotes ? `Recent intake notes: ${recentUserNotes}` : undefined,
    attachedFileNames ? `Attached context files: ${attachedFileNames}` : undefined,
    parsedFileSummaries ? `Document context highlights: ${parsedFileSummaries}` : undefined,
  ].filter(Boolean);

  return contextParts.join(' ');
}

function buildIntakeSummary({
  messages,
  selectedTestIds,
  structuredIntake,
  uploadedFiles,
}: {
  messages: IntakeChatMessage[];
  selectedTestIds: ValidationTestId[];
  structuredIntake: StructuredIntakeContext;
  uploadedFiles: UploadedContextFile[];
}) {
  const recentUserNotes = messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join(' ');

  const selectedTestsSummary =
    selectedTestIds.length > 0
      ? `Selected validation tests: ${selectedTestIds
          .map((testId) => getValidationTestLabel(testId))
          .join(', ')}.`
      : 'No validation tests selected.';

  const fileSummary =
    uploadedFiles.length > 0
      ? `Attached file count: ${uploadedFiles.length}. Parsed files: ${
          uploadedFiles.filter((file) => file.ingestionStatus === 'parsed').length
        }.`
      : 'No attached files.';

  const structuredSummary = summarizeStructuredIntake(structuredIntake);

  return [
    structuredSummary,
    recentUserNotes || 'No additional user notes yet.',
    selectedTestsSummary,
    fileSummary,
  ]
    .filter(Boolean)
    .join(' ');
}

function mapAttachedFiles(
  uploadedFiles: UploadedContextFile[]
): ReviewAttachedFileMetadata[] {
  return uploadedFiles.map((file) => ({
    uploadId: file.uploadId,
    name: file.name,
    size: file.size,
    type: file.type,
    ingestionStatus: file.ingestionStatus,
    extractedText: file.extractedText,
    ingestionError: file.ingestionError,
  }));
}

function getProductLabel(appUrl: string) {
  try {
    return new URL(appUrl).hostname.replace(/^www\./, '') || 'this product';
  } catch {
    return 'this product';
  }
}

function getActiveTextTarget(inputMode: InputMode, appUrl: string, figmaUrl: string) {
  return inputMode === 'figma' ? figmaUrl : appUrl;
}

function hasValidInput({
  appUrl,
  figmaUrl,
  inputMode,
  screenshots,
  videos,
}: {
  appUrl: string;
  figmaUrl: string;
  inputMode: InputMode;
  screenshots: File[];
  videos: File[];
}) {
  return !getInputValidationError({ appUrl, figmaUrl, inputMode, screenshots, videos });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Could not read screenshot "${file.name}".`));
    };

    reader.onerror = () => {
      reject(new Error(`Could not read screenshot "${file.name}".`));
    };

    reader.readAsDataURL(file);
  });
}

function readVideoFrameAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const context = canvas.getContext('2d');

        if (!context) {
          cleanup();
          reject(new Error(`Could not read video "${file.name}".`));
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/png');
        cleanup();
        resolve(result);
      } catch {
        cleanup();
        reject(new Error(`Could not read video "${file.name}".`));
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Could not read video "${file.name}".`));
    };
  });
}

function getInputValidationError({
  appUrl,
  figmaUrl,
  inputMode,
  screenshots,
  videos,
}: {
  appUrl: string;
  figmaUrl: string;
  inputMode: InputMode;
  screenshots: File[];
  videos: File[];
}) {
  if (inputMode === 'figma' && !figmaUrl.trim()) {
    return 'Add a Figma prototype link before running the suite.';
  }

  if (inputMode === 'screenshots' && screenshots.length === 0) {
    return 'Add at least one screenshot before running the suite.';
  }

  if (inputMode === 'video' && videos.length === 0) {
    return 'Add at least one video before running the suite.';
  }

  if (inputMode === 'url' && !appUrl.trim()) {
    return 'Add the primary app URL before running the suite.';
  }

  return null;
}

function getValidationTestLabel(testId: ValidationTestId) {
  return VALIDATION_TEST_CATALOG.find((test) => test.id === testId)?.label || testId;
}

function mergeStructuredIntakeContext(
  base: StructuredIntakeContext,
  updates?: StructuredIntakeUpdate
): StructuredIntakeContext {
  return {
    productSummary: mergeStructuredText(base.productSummary, updates?.productSummary),
    targetAudience: mergeStructuredText(base.targetAudience, updates?.targetAudience),
    audienceNeeds: mergeStructuredList(base.audienceNeeds, updates?.audienceNeeds),
    keyFlowsOrJobs: mergeStructuredList(base.keyFlowsOrJobs, updates?.keyFlowsOrJobs),
    onboardingConcerns: mergeStructuredList(
      base.onboardingConcerns,
      updates?.onboardingConcerns
    ),
    engagementConcerns: mergeStructuredList(
      base.engagementConcerns,
      updates?.engagementConcerns
    ),
    accessibilityConcerns: mergeStructuredList(
      base.accessibilityConcerns,
      updates?.accessibilityConcerns
    ),
    complianceConcerns: mergeStructuredList(
      base.complianceConcerns,
      updates?.complianceConcerns
    ),
    additionalNotes: mergeStructuredText(base.additionalNotes, updates?.additionalNotes),
  };
}

function mergeStructuredIntakeUpdateState(
  current: StructuredIntakeUpdate,
  updates?: StructuredIntakeUpdate
): StructuredIntakeUpdate {
  if (!updates) {
    return current;
  }

  return compactStructuredIntakeUpdate({
    productSummary: mergeStructuredText(current.productSummary, updates.productSummary),
    targetAudience: mergeStructuredText(current.targetAudience, updates.targetAudience),
    audienceNeeds: mergeStructuredList(current.audienceNeeds || [], updates.audienceNeeds),
    keyFlowsOrJobs: mergeStructuredList(
      current.keyFlowsOrJobs || [],
      updates.keyFlowsOrJobs
    ),
    onboardingConcerns: mergeStructuredList(
      current.onboardingConcerns || [],
      updates.onboardingConcerns
    ),
    engagementConcerns: mergeStructuredList(
      current.engagementConcerns || [],
      updates.engagementConcerns
    ),
    accessibilityConcerns: mergeStructuredList(
      current.accessibilityConcerns || [],
      updates.accessibilityConcerns
    ),
    complianceConcerns: mergeStructuredList(
      current.complianceConcerns || [],
      updates.complianceConcerns
    ),
    additionalNotes: mergeStructuredText(current.additionalNotes, updates.additionalNotes),
  });
}

function compactStructuredIntakeUpdate(
  update: StructuredIntakeUpdate
): StructuredIntakeUpdate {
  const compacted: StructuredIntakeUpdate = {};

  if (update.productSummary?.trim()) {
    compacted.productSummary = update.productSummary.trim();
  }

  if (update.targetAudience?.trim()) {
    compacted.targetAudience = update.targetAudience.trim();
  }

  if (update.audienceNeeds?.length) {
    compacted.audienceNeeds = mergeStructuredList([], update.audienceNeeds);
  }

  if (update.keyFlowsOrJobs?.length) {
    compacted.keyFlowsOrJobs = mergeStructuredList([], update.keyFlowsOrJobs);
  }

  if (update.onboardingConcerns?.length) {
    compacted.onboardingConcerns = mergeStructuredList([], update.onboardingConcerns);
  }

  if (update.engagementConcerns?.length) {
    compacted.engagementConcerns = mergeStructuredList([], update.engagementConcerns);
  }

  if (update.accessibilityConcerns?.length) {
    compacted.accessibilityConcerns = mergeStructuredList(
      [],
      update.accessibilityConcerns
    );
  }

  if (update.complianceConcerns?.length) {
    compacted.complianceConcerns = mergeStructuredList([], update.complianceConcerns);
  }

  if (update.additionalNotes?.trim()) {
    compacted.additionalNotes = update.additionalNotes.trim();
  }

  return compacted;
}

function mergeStructuredText(base?: string, incoming?: string) {
  const incomingValue = incoming?.trim();

  if (incomingValue) {
    return incomingValue;
  }

  const baseValue = base?.trim();
  return baseValue || undefined;
}

function mergeStructuredList(base: string[] = [], incoming?: string[]) {
  const merged: string[] = [];
  const seen = new Set<string>();

  [...base, ...(incoming || [])]
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(item);
    });

  return merged.slice(0, 6);
}

function deriveStructuredIntakeContext({
  appUrl,
  messages,
  selectedTestIds,
  uploadedFiles,
}: {
  appUrl: string;
  messages: IntakeChatMessage[];
  selectedTestIds: ValidationTestId[];
  uploadedFiles: UploadedContextFile[];
}): StructuredIntakeContext {
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean);
  const combinedNotes = userMessages.join('\n');
  const productLabel = getProductLabel(appUrl);

  const structuredIntake: StructuredIntakeContext = {
    productSummary:
      pickFirstMatchingLine(userMessages, [
        'product',
        'platform',
        'tool',
        'app',
        'helps',
        'used to',
        'used for',
        'lets',
      ]) ||
      (userMessages[0]
        ? `The product under review is ${productLabel}. ${truncateSentence(userMessages[0], 180)}`
        : appUrl
          ? `The product under review is ${productLabel}.`
          : undefined),
    targetAudience:
      pickFirstMatchingLine(userMessages, [
        'audience',
        'customer',
        'user',
        'buyer',
        'team',
        'for ',
      ]) || undefined,
    audienceNeeds: collectRelevantSnippets(userMessages, [
      'need',
      'needs',
      'want',
      'wants',
      'goal',
      'pain',
      'problem',
      'trying to',
    ]),
    keyFlowsOrJobs: collectRelevantSnippets(userMessages, [
      'flow',
      'signup',
      'sign up',
      'onboarding',
      'activation',
      'checkout',
      'trial',
      'job',
      'task',
      'journey',
    ]),
    onboardingConcerns: collectRelevantSnippets(userMessages, [
      'onboarding',
      'signup',
      'sign up',
      'activation',
      'first run',
      'first-time',
      'setup',
    ]),
    engagementConcerns: collectRelevantSnippets(userMessages, [
      'engagement',
      'retention',
      'habit',
      'return',
      'revisit',
      'stickiness',
      'recurring',
    ]),
    accessibilityConcerns: collectRelevantSnippets(userMessages, [
      'accessibility',
      'a11y',
      'screen reader',
      'contrast',
      'keyboard',
      'wcag',
      'voiceover',
    ]),
    complianceConcerns: collectRelevantSnippets(userMessages, [
      'compliance',
      'privacy',
      'consent',
      'hipaa',
      'soc 2',
      'soc2',
      'gdpr',
      'security',
      'legal',
    ]),
    additionalNotes: buildAdditionalNotes({
      combinedNotes,
      selectedTestIds,
      uploadedFiles,
    }),
  };

  if (!structuredIntake.targetAudience && structuredIntake.audienceNeeds.length > 0) {
    structuredIntake.targetAudience =
      'The audience is described implicitly through their goals and pain points in chat.';
  }

  return structuredIntake;
}

function summarizeStructuredIntake(structuredIntake: StructuredIntakeContext) {
  const sections = [
    structuredIntake.productSummary
      ? `Product summary: ${structuredIntake.productSummary}`
      : '',
    structuredIntake.targetAudience
      ? `Target audience: ${structuredIntake.targetAudience}`
      : '',
    structuredIntake.keyFlowsOrJobs.length > 0
      ? `Key flows or jobs: ${structuredIntake.keyFlowsOrJobs.join(', ')}.`
      : '',
    structuredIntake.onboardingConcerns.length > 0
      ? `Onboarding concerns: ${structuredIntake.onboardingConcerns.join(', ')}.`
      : '',
    structuredIntake.engagementConcerns.length > 0
      ? `Engagement concerns: ${structuredIntake.engagementConcerns.join(', ')}.`
      : '',
    structuredIntake.accessibilityConcerns.length > 0
      ? `Accessibility concerns: ${structuredIntake.accessibilityConcerns.join(', ')}.`
      : '',
    structuredIntake.complianceConcerns.length > 0
      ? `Compliance concerns: ${structuredIntake.complianceConcerns.join(', ')}.`
      : '',
  ].filter(Boolean);

  return sections.join(' ');
}

function countStructuredIntakeSignals(structuredIntake: StructuredIntakeContext) {
  const optionalFields = [
    structuredIntake.productSummary,
    structuredIntake.targetAudience,
    structuredIntake.additionalNotes,
  ].filter(Boolean).length;

  return (
    optionalFields +
    structuredIntake.audienceNeeds.length +
    structuredIntake.keyFlowsOrJobs.length +
    structuredIntake.onboardingConcerns.length +
    structuredIntake.engagementConcerns.length +
    structuredIntake.accessibilityConcerns.length +
    structuredIntake.complianceConcerns.length
  );
}

function pickFirstMatchingLine(lines: string[], keywords: string[]) {
  return (
    lines.find((line) =>
      keywords.some((keyword) => line.toLowerCase().includes(keyword))
    ) || ''
  );
}

function collectRelevantSnippets(lines: string[], keywords: string[]) {
  const snippets = lines
    .flatMap((line) => splitIntoSentences(line))
    .filter((sentence) =>
      keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
    )
    .map((sentence) => truncateSentence(sentence, 140));

  return Array.from(new Set(snippets)).slice(0, 3);
}

function buildAdditionalNotes({
  combinedNotes,
  selectedTestIds,
  uploadedFiles,
}: {
  combinedNotes: string;
  selectedTestIds: ValidationTestId[];
  uploadedFiles: UploadedContextFile[];
}) {
  const detailParts = [];

  if (combinedNotes) {
    detailParts.push(truncateSentence(combinedNotes.replace(/\n+/g, ' '), 220));
  }

  if (selectedTestIds.length > 0) {
    detailParts.push(
      `Current validation focus: ${selectedTestIds
        .map((testId) => getValidationTestLabel(testId))
        .join(', ')}.`
    );
  }

  const parsedFiles = uploadedFiles.filter((file) => file.ingestionStatus === 'parsed');

  if (parsedFiles.length > 0) {
    detailParts.push(
      `Supporting documents with extracted text: ${parsedFiles
        .slice(0, 3)
        .map((file) => file.name)
        .join(', ')}.`
    );
  }

  return detailParts.join(' ').trim() || undefined;
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function truncateSentence(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function createPendingUploadedFile(file: File): UploadedContextFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    type: file.type,
    ingestionStatus: 'uploading',
  };
}

function mergeUploadedFiles(
  currentFiles: UploadedContextFile[],
  incomingFiles: UploadedContextFile[]
) {
  const filesById = new Map(currentFiles.map((file) => [file.id, file]));

  incomingFiles.forEach((file) => {
    filesById.set(file.id, {
      ...filesById.get(file.id),
      ...file,
    });
  });

  return Array.from(filesById.values());
}

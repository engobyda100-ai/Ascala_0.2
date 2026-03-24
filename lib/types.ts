// types.ts

export interface Persona {
  name: string;
  description?: string;
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
  captureLabel?: string;
  relatedTestIds?: ValidationTestId[];
  observation?: string;
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

export type ValidationTestId =
  | 'engagement-habit-formation'
  | 'onboarding'
  | 'accessibility'
  | 'compliance';

export interface ValidationTestCatalogItem {
  id: ValidationTestId;
  label: string;
  helperText?: string;
}

export const VALIDATION_TEST_CATALOG: ValidationTestCatalogItem[] = [
  {
    id: 'engagement-habit-formation',
    label: 'Engagement',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
  },
  {
    id: 'compliance',
    label: 'Compliance',
  },
];

export interface ValidationTestResult {
  id: ValidationTestId;
  label: string;
  score: number;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
}

export type BrowserExplorationAttemptStatus =
  | 'planned'
  | 'attempted'
  | 'completed'
  | 'not_found'
  | 'failed';

export interface BrowserExplorationObjective {
  testId: ValidationTestId;
  label: string;
  goal: string;
  observationFocus: string;
}

export interface BrowserExplorationAttempt {
  testId: ValidationTestId;
  label: string;
  goal: string;
  attemptedAction: string;
  status: BrowserExplorationAttemptStatus;
  url: string;
  pageTitle: string;
  observation: string;
}

export interface BrowserExplorationSummary {
  objectives: BrowserExplorationObjective[];
  attempts: BrowserExplorationAttempt[];
  summary: string;
}

export type FigmaLinkType = 'proto' | 'file' | 'make' | 'unknown';

export interface UXAnalysis {
  findings: UXFinding[];
  metrics: MetricPrediction[];
  recommendations: Recommendation[];
  personaVerdict: string;
  selectedTestResults: ValidationTestResult[];
}

export interface UXReport extends UXAnalysis {
  persona: Persona;
  screenshots: ScreenCapture[];
  browserExplorationSummary?: BrowserExplorationSummary;
  pipelineNotice?: string;
}

export type FileIngestionStatus =
  | 'uploading'
  | 'parsed'
  | 'metadata-only'
  | 'error';

export interface ReviewAttachedFileMetadata {
  uploadId?: string;
  name: string;
  size: number;
  type: string;
  ingestionStatus?: FileIngestionStatus;
  extractedText?: string;
  ingestionError?: string;
}

export interface StructuredIntakeContext {
  productSummary?: string;
  targetAudience?: string;
  audienceNeeds: string[];
  keyFlowsOrJobs: string[];
  onboardingConcerns: string[];
  engagementConcerns: string[];
  accessibilityConcerns: string[];
  complianceConcerns: string[];
  additionalNotes?: string;
}

export type InputMode = 'url' | 'figma' | 'screenshots' | 'video';

export interface ReviewRequest {
  targetMarket: string;
  appUrl?: string;
  inputMode?: InputMode;
  figmaUrl?: string;
  screenshots?: string[];
  selectedTestIds?: ValidationTestId[];
  intakeSummary?: string;
  productContext?: string;
  structuredIntake?: StructuredIntakeContext;
  attachedFiles?: ReviewAttachedFileMetadata[];
}

export interface BrowserSessionResult {
  screenshots: ScreenCapture[];
  explorationSummary: BrowserExplorationSummary;
  pipelineNotice?: string;
}

export type IntakeAssetStatus = 'ready' | 'pending';

export interface IntakeAssetSummary {
  id: string;
  label: string;
  value: string;
  helperText: string;
  status: IntakeAssetStatus;
}

export interface UploadedContextFile {
  id: string;
  uploadId?: string;
  name: string;
  size: number;
  type: string;
  ingestionStatus: FileIngestionStatus;
  extractedText?: string;
  ingestionError?: string;
}

export interface UploadFilesResponse {
  files: UploadedContextFile[];
}

export type IntakeChatMessageRole = 'assistant' | 'user';

export interface IntakeChatMessage {
  id: string;
  role: IntakeChatMessageRole;
  content: string;
  timestamp: string;
  coachPayload?: IntakeCoachMessagePayload;
}

export type ChatAgentMode = 'intake' | 'coaching' | 'analysis' | 'action';
export type ChatAgentTrigger = 'message' | 'post-run';

export interface IntakeCoachMessagePayload {
  recommendedTestIds?: ValidationTestId[];
  checklistItems?: string[];
  insightHighlights?: string[];
  nextAction?: string;
  mode?: ChatAgentMode;
}

export type StructuredIntakeUpdate = Partial<StructuredIntakeContext>;

export interface ChatAgentRequest {
  recentMessages: IntakeChatMessage[];
  selectedTestIds: ValidationTestId[];
  structuredIntake?: StructuredIntakeContext;
  attachedFiles?: ReviewAttachedFileMetadata[];
  latestResultsSummary?: ValidationResultSummary | null;
  selectedTestResults?: ValidationResultTestSummary[];
  browserExplorationSummary?: BrowserExplorationSummary;
  runState?: WorkspaceRunState;
  currentStage?: string;
  trigger?: ChatAgentTrigger;
}

export interface ChatAgentResponse {
  assistantMessage: string;
  recommendedTestIds?: ValidationTestId[];
  intakeUpdates?: StructuredIntakeUpdate;
  checklistItems?: string[];
  insightHighlights?: string[];
  nextAction?: string;
  mode?: ChatAgentMode;
}

export type ValidationItemStatus = 'ready' | 'running' | 'passed' | 'warning';

export interface ValidationSuiteItem {
  id: string;
  title: string;
  detail: string;
  status: ValidationItemStatus;
}

export type ValidationTestGroupKey = 'selected-validation-tests';

export interface ValidationTestDefinition {
  id: ValidationTestId;
  label: string;
  helperText?: string;
}

export interface ValidationTestGroup {
  id: ValidationTestGroupKey;
  label: string;
  tests: ValidationTestDefinition[];
}

export type ValidationProgressStepStatus = 'pending' | 'active' | 'complete';

export interface ValidationProgressStep {
  id: string;
  label: string;
  status: ValidationProgressStepStatus;
}

export interface ValidationResultListItem {
  title: string;
  detail: string;
}

export interface ValidationResultTestSummary {
  id: ValidationTestId;
  label: string;
  score?: number;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  status: 'completed' | 'pending';
}

export interface ValidationResultSummary {
  overallScore: number;
  summary: string;
  topFindings: ValidationResultListItem[];
  topRecommendations: ValidationResultListItem[];
  selectedTests: ValidationResultTestSummary[];
}

export type ValidationRunStatus = 'idle' | 'running' | 'success' | 'error';

export interface WorkspaceRunState {
  status: ValidationRunStatus;
  error?: string;
  lastRunAt?: string;
}

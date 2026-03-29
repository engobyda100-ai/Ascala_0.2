'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Minus,
  Plus,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { ResultsPanel } from '@/components/intake/ResultsPanel';
import { ValidationPanel } from '@/components/intake/ValidationPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  GeneratedPersona,
  ValidationProgressStep,
  ValidationResultSummary,
  ValidationResultTestSummary,
  ValidationTestGroup,
  ValidationTestId,
  WorkspaceRunState,
} from '@/lib/types';

type RightPanelStepId = 'generate' | 'choose' | 'tests' | 'results';

interface RightPanelFlowProps {
  groups: ValidationTestGroup[];
  completedTestIds: ValidationTestId[];
  pendingTestIds: ValidationTestId[];
  selectedTestIds: ValidationTestId[];
  currentStage: string;
  personaCount: number;
  generatedPersonas: GeneratedPersona[];
  selectedPersonaId: string | null;
  personaGenerationStatus: 'idle' | 'loading' | 'success' | 'error';
  personaGenerationError?: string;
  hasPendingPersonaRegenerationDecision: boolean;
  requiresPersonaRegeneration: boolean;
  hasPersonasForCurrentCount: boolean;
  resultsPersonaBadge?: string | null;
  progressSteps: ValidationProgressStep[];
  resultSummary: ValidationResultSummary | null;
  runState: WorkspaceRunState;
  canRun: boolean;
  canGeneratePersonas: boolean;
  personaGenerationReadinessMessage: string;
  onAcceptPersonaRegenerationPrompt: () => void;
  onDismissPersonaRegenerationPrompt: () => void;
  onGeneratePersonas: () => void;
  onPersonaCountChange: (next: number) => void;
  onRun: () => void;
  onSelectPersona: (personaId: string) => void;
  onToggleTest: (testId: ValidationTestId) => void;
  onOpenExpandedReader: () => void;
  onOpenTestReport: (testId: ValidationResultTestSummary['id']) => void;
}

export function RightPanelFlow({
  groups,
  completedTestIds,
  pendingTestIds,
  selectedTestIds,
  currentStage,
  personaCount,
  generatedPersonas,
  selectedPersonaId,
  personaGenerationStatus,
  personaGenerationError,
  hasPendingPersonaRegenerationDecision,
  requiresPersonaRegeneration,
  hasPersonasForCurrentCount,
  resultsPersonaBadge,
  progressSteps,
  resultSummary,
  runState,
  canRun,
  canGeneratePersonas,
  personaGenerationReadinessMessage,
  onAcceptPersonaRegenerationPrompt,
  onDismissPersonaRegenerationPrompt,
  onGeneratePersonas,
  onPersonaCountChange,
  onRun,
  onSelectPersona,
  onToggleTest,
  onOpenExpandedReader,
  onOpenTestReport,
}: RightPanelFlowProps) {
  const [activeStep, setActiveStep] = useState<RightPanelStepId>('generate');
  const selectedCount = selectedTestIds.length;
  const generatedCount = generatedPersonas.length;
  const hasCompletedResults = Boolean(
    resultSummary?.selectedTests.some((test) => test.status === 'completed')
  );
  const generateStepComplete =
    hasPersonasForCurrentCount && !requiresPersonaRegeneration;
  const chooseStepComplete = Boolean(selectedPersonaId);
  const testsStepComplete = selectedCount > 0;
  const chooseStepUnlocked = generatedCount > 0;
  const testsStepUnlocked = Boolean(selectedPersonaId);
  const resultsStepUnlocked =
    (Boolean(selectedPersonaId) && selectedCount > 0) ||
    hasCompletedResults ||
    runState.status === 'running';
  const testLabelById = useMemo(
    () =>
      new Map(
        groups.flatMap((group) =>
          group.tests.map((test) => [test.id, test.label] as const)
        )
      ),
    [groups]
  );
  const selectedPersona =
    generatedPersonas.find((persona) => persona.id === selectedPersonaId) || null;
  const selectedTestSummary = summarizeTestSelection(
    selectedTestIds.map((testId) => testLabelById.get(testId) || testId)
  );
  const generateSummary = getGenerateSummary({
    generatedCount,
    hasPendingPersonaRegenerationDecision,
    hasPersonasForCurrentCount,
    personaCount,
    personaGenerationError,
    personaGenerationStatus,
    requiresPersonaRegeneration,
  });
  const chooseSummary = getChooseSummary({
    generatedCount,
    personaCount,
    personaGenerationError,
    personaGenerationStatus,
    selectedPersona,
  });
  const resultsSummary = getResultsSummary(resultSummary, runState);
  const runStatusMessage = getRunStatusMessage({
    canRun,
    currentStage,
    generatedCount,
    hasCompletedResults,
    hasPendingPersonaRegenerationDecision,
    hasPersonasForCurrentCount,
    personaCount,
    requiresPersonaRegeneration,
    runState,
    selectedCount,
    selectedPersona,
  });

  useEffect(() => {
    if (personaGenerationStatus === 'loading' || requiresPersonaRegeneration) {
      setActiveStep('generate');
    }
  }, [personaGenerationStatus, requiresPersonaRegeneration]);

  useEffect(() => {
    if (personaGenerationStatus === 'success' && generatedCount > 0) {
      setActiveStep('choose');
    }
  }, [generatedCount, personaGenerationStatus]);

  useEffect(() => {
    if (activeStep === 'results' && !resultsStepUnlocked) {
      setActiveStep(testsStepUnlocked ? 'tests' : chooseStepUnlocked ? 'choose' : 'generate');
      return;
    }

    if (activeStep === 'tests' && !testsStepUnlocked) {
      setActiveStep(chooseStepUnlocked ? 'choose' : 'generate');
      return;
    }

    if (activeStep === 'choose' && !chooseStepUnlocked) {
      setActiveStep('generate');
    }
  }, [activeStep, chooseStepUnlocked, resultsStepUnlocked, testsStepUnlocked]);

  const handleOpenStep = (step: RightPanelStepId) => {
    if (step === 'generate') {
      setActiveStep(step);
      return;
    }

    if (step === 'choose' && chooseStepUnlocked) {
      setActiveStep(step);
      return;
    }

    if (step === 'tests' && testsStepUnlocked) {
      setActiveStep(step);
      return;
    }

    if (step === 'results' && resultsStepUnlocked) {
      setActiveStep(step);
    }
  };

  const handleGeneratePersonasClick = () => {
    setActiveStep('generate');
    onGeneratePersonas();
  };

  const handleContinueToTests = () => {
    if (!selectedPersonaId) {
      return;
    }

    setActiveStep('tests');
  };

  const handleContinueToSimulation = () => {
    if (selectedCount === 0) {
      return;
    }

    setActiveStep('results');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2 pr-1">
      {hasPendingPersonaRegenerationDecision ? (
        <div className="rounded-[20px] border border-[#C26A43]/30 bg-[#FFF4EC] px-4 py-3 shadow-[0_18px_38px_-28px_rgba(61,23,0,0.32)]">
          <p className="text-[12px] font-semibold text-[#8E4524]">
            Would you like to regenerate personas based on the new context?
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDismissPersonaRegenerationPrompt}
              className="h-8 rounded-full border-[#C26A43]/25 bg-white/75 px-4 text-xs text-[#8E4524] hover:bg-white"
            >
              No
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onAcceptPersonaRegenerationPrompt}
              className="h-8 rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
            >
              Yes
            </Button>
          </div>
        </div>
      ) : null}

      <StepSection
        icon={Sparkles}
        isActive={activeStep === 'generate'}
        isComplete={generateStepComplete}
        isLocked={false}
        onOpen={() => handleOpenStep('generate')}
        summary={generateSummary}
        shouldFillActive
        title="Generate Persona"
      >
        <div className="flex flex-col">
          <div className="px-4 py-4">
            <div className="space-y-4">
              {personaGenerationStatus !== 'loading' ? (
                <div className="rounded-[24px] border border-border/45 bg-white/40 px-4 py-4 shadow-[0_18px_38px_-28px_rgba(61,23,0,0.22)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Persona Count
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-border/40 bg-white/72 px-3 py-3">
                    <button
                      type="button"
                      disabled={personaCount <= 3}
                      onClick={() => onPersonaCountChange(personaCount - 1)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl border border-border/45 bg-white text-[#3D1700] shadow-sm transition-colors hover:bg-white/80',
                        personaCount <= 3 && 'cursor-not-allowed opacity-45'
                      )}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="text-center">
                      <p className="text-[28px] font-semibold leading-none text-foreground">
                        {personaCount}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatPersonaCountLabel(personaCount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={personaCount >= 10}
                      onClick={() => onPersonaCountChange(personaCount + 1)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl border border-border/45 bg-white text-[#3D1700] shadow-sm transition-colors hover:bg-white/80',
                        personaCount >= 10 && 'cursor-not-allowed opacity-45'
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {personaGenerationStatus === 'loading' ? <PersonaGenerationLoadingState /> : null}

              {personaGenerationError ? (
                <div className="rounded-[24px] border border-[rgba(194,106,67,0.35)] bg-[#FFF5EF] px-4 py-3 text-[12px] leading-5 text-[#8E4524]">
                  {personaGenerationError}
                </div>
              ) : null}

              {requiresPersonaRegeneration ? (
                <div className="rounded-[24px] border border-border/45 bg-white/38 px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                  Regenerate personas from the latest context before the next run.
                </div>
              ) : null}

              {!hasPersonasForCurrentCount && generatedCount > 0 ? (
                <div className="rounded-[24px] border border-border/45 bg-white/38 px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                  The current list has {generatedCount} persona
                  {generatedCount === 1 ? '' : 's'}. Generate again to create{' '}
                  {personaCount}.
                </div>
              ) : null}

              {generatedCount === 0 && personaGenerationStatus === 'idle' ? (
                <div className="rounded-[24px] border border-dashed border-border/45 bg-white/24 px-4 py-6 text-center text-[12px] leading-5 text-muted-foreground">
                  {personaGenerationReadinessMessage}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border/45 px-4 py-3">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Button
                disabled={
                  !canGeneratePersonas ||
                  personaGenerationStatus === 'loading' ||
                  runState.status === 'running'
                }
                onClick={handleGeneratePersonasClick}
                size="sm"
                className="h-8 min-w-[154px] rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
              >
                Generate Personas
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                {personaCount} tokens
              </p>
            </div>
          </div>
        </div>
      </StepSection>

      <StepSection
        icon={UserRound}
        isActive={activeStep === 'choose'}
        isComplete={chooseStepComplete}
        isLocked={!chooseStepUnlocked}
        onOpen={() => handleOpenStep('choose')}
        summary={
          chooseStepUnlocked ? chooseSummary : 'Generated personas will appear here next.'
        }
        shouldFillActive={false}
        title="Choose Persona"
      >
        <div className="flex flex-col">
          <div className="px-4 py-4">
            <div className="space-y-3">
              <p className="text-[13px] font-semibold">Persona Profiles</p>

              {!hasPersonasForCurrentCount && generatedCount > 0 ? (
                <div className="rounded-[24px] border border-border/45 bg-white/38 px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                  The current persona list does not match the selected count yet. You can
                  still review it here, but generate again before running.
                </div>
              ) : null}

              {generatedCount > 0 ? (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1">
                  {generatedPersonas.map((persona) => {
                    const isSelected = persona.id === selectedPersonaId;
                    const painPoints = persona.frustrations.slice(0, 2);

                    return (
                      <button
                        key={persona.id}
                        type="button"
                        disabled={
                          personaGenerationStatus === 'loading' ||
                          runState.status === 'running'
                        }
                        onClick={() => onSelectPersona(persona.id)}
                        className={cn(
                          'flex min-h-[292px] min-w-[264px] snap-start flex-col rounded-[24px] border px-4 py-4 text-left shadow-[0_18px_38px_-28px_rgba(61,23,0,0.45)] transition-colors',
                          isSelected
                            ? 'border-[#C26A43]/60 bg-white ring-1 ring-[#C26A43]/30'
                            : 'border-border/45 bg-white/42 hover:bg-white/60',
                          (personaGenerationStatus === 'loading' ||
                            runState.status === 'running') &&
                            'cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold',
                              isSelected
                                ? 'border-[#C26A43]/45 bg-[#F6E4D9] text-[#A24F2A]'
                                : 'border-border/55 bg-white/80 text-foreground/75'
                            )}
                          >
                            {getPersonaInitials(persona.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold">{persona.name}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {persona.age}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Demographics
                          </p>
                          <p className="text-[13px] leading-5 text-foreground/85">
                            {persona.jobTitle} · {persona.companySize}
                          </p>
                        </div>

                        <div className="mt-4 flex-1 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Pain Points
                          </p>
                          <div className="space-y-2">
                            {painPoints.map((painPoint) => (
                              <div
                                key={painPoint}
                                className="rounded-2xl border border-border/40 bg-white/65 px-3 py-2 text-[12px] leading-5 text-foreground/80"
                              >
                                {painPoint}
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-border/45 bg-white/24 px-4 py-6 text-center text-[12px] leading-5 text-muted-foreground">
                  Generate personas to open this step.
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border/45 px-4 py-3">
            <Button
              onClick={handleContinueToTests}
              disabled={!selectedPersonaId || runState.status === 'running'}
              size="sm"
              className="h-8 rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
            >
              Continue to Tests
            </Button>
          </div>
        </div>
      </StepSection>

      <StepSection
        icon={ListChecks}
        isActive={activeStep === 'tests'}
        isComplete={testsStepComplete}
        isLocked={!testsStepUnlocked}
        onOpen={() => handleOpenStep('tests')}
        summary={
          testsStepUnlocked ? selectedTestSummary : 'Choose a persona to unlock tests.'
        }
        title="Decide Tests"
      >
        <div className="flex flex-col">
          <div>
            <ValidationPanel
              completedTestIds={completedTestIds}
              currentStage={currentStage}
              groups={groups}
              pendingTestIds={pendingTestIds}
              selectedTestIds={selectedTestIds}
              runState={runState}
              canRun={canRun}
              showExecutionFooter={false}
              onRun={onRun}
              onToggleTest={onToggleTest}
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/45 px-4 py-3">
            <p className="max-w-[220px] text-[11px] leading-4 text-muted-foreground">
              Choose which validation checks should run for the selected persona.
            </p>
            <Button
              disabled={selectedCount === 0 || runState.status === 'running'}
              onClick={handleContinueToSimulation}
              size="sm"
              className="h-8 rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
            >
              Continue to Simulation
            </Button>
          </div>
        </div>
      </StepSection>

      <StepSection
        icon={BarChart3}
        isActive={activeStep === 'results'}
        isComplete={hasCompletedResults}
        isLocked={!resultsStepUnlocked}
        onOpen={() => handleOpenStep('results')}
        summary={
          resultsStepUnlocked
            ? resultsSummary
            : 'Simulation opens here after a persona and tests are chosen.'
        }
        title="Simulation Run"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border/45 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Simulation Run
              </p>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                {runStatusMessage}
              </p>
              {runState.lastRunAt ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Last completed run: {runState.lastRunAt}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Button
                onClick={onRun}
                disabled={!canRun}
                size="sm"
                className="h-8 min-w-[154px] rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
              >
                Run Simulation
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                {selectedCount * 4} tokens
              </p>
            </div>
          </div>
          <div>
            <ResultsPanel
              onOpenExpandedReader={onOpenExpandedReader}
              onOpenTestReport={onOpenTestReport}
              progressSteps={progressSteps}
              resultsPersonaBadge={resultsPersonaBadge}
              resultSummary={resultSummary}
              runState={runState}
            />
          </div>
        </div>
      </StepSection>
    </div>
  );
}

function StepSection({
  icon: Icon,
  isActive,
  isComplete,
  isLocked,
  onOpen,
  summary,
  shouldFillActive = true,
  title,
  children,
}: {
  icon: LucideIcon;
  isActive: boolean;
  isComplete: boolean;
  isLocked: boolean;
  onOpen: () => void;
  summary: string;
  shouldFillActive?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'shrink-0 rounded-[20px] border border-border/45 transition-all duration-200',
        isActive
          ? 'bg-white/58'
          : 'shrink-0 bg-white/26',
        isLocked && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={isLocked}
        className={cn(
          'flex items-center gap-3 px-4 py-3 text-left transition-colors',
          isLocked ? 'cursor-default' : 'hover:bg-white/35'
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-white/82 shadow-sm',
            isComplete
              ? 'border-[#C26A43]/40 bg-[#F6E4D9] text-[#C26A43]'
              : 'border-border/55 text-[#3D1700]'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{summary}</p>
        </div>
        {isActive ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isActive && !isLocked ? (
        <div className="border-t border-border/45">{children}</div>
      ) : null}
    </section>
  );
}

function summarizeTestSelection(labels: string[]) {
  if (labels.length === 0) {
    return 'Choose which validation checks should run.';
  }

  if (labels.length <= 2) {
    return labels.join(' · ');
  }

  return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2} more`;
}

function formatPersonaCountLabel(count: number) {
  return `${count} personas`;
}

function getGenerateSummary({
  generatedCount,
  hasPendingPersonaRegenerationDecision,
  hasPersonasForCurrentCount,
  personaCount,
  personaGenerationError,
  personaGenerationStatus,
  requiresPersonaRegeneration,
}: {
  generatedCount: number;
  hasPendingPersonaRegenerationDecision: boolean;
  hasPersonasForCurrentCount: boolean;
  personaCount: number;
  personaGenerationError?: string;
  personaGenerationStatus: 'idle' | 'loading' | 'success' | 'error';
  requiresPersonaRegeneration: boolean;
}) {
  if (personaGenerationStatus === 'loading') {
    return `Generating ${personaCount} personas from the latest context...`;
  }

  if (hasPendingPersonaRegenerationDecision) {
    return 'New context detected. Decide whether to regenerate personas.';
  }

  if (requiresPersonaRegeneration) {
    return 'Regenerate personas from the latest context.';
  }

  if (personaGenerationError) {
    return 'Persona generation hit an error.';
  }

  if (hasPersonasForCurrentCount) {
    return `${generatedCount} personas ready for selection.`;
  }

  if (generatedCount > 0) {
    return `Generate again to create ${personaCount} personas.`;
  }

  return 'Generate personas from chat, product input, and uploaded context.';
}

function getChooseSummary({
  generatedCount,
  personaCount,
  personaGenerationError,
  personaGenerationStatus,
  selectedPersona,
}: {
  generatedCount: number;
  personaCount: number;
  personaGenerationError?: string;
  personaGenerationStatus: 'idle' | 'loading' | 'success' | 'error';
  selectedPersona: GeneratedPersona | null;
}) {
  if (selectedPersona) {
    return `${selectedPersona.name} · Ready for tests`;
  }

  if (personaGenerationStatus === 'loading') {
    return 'Personas are being generated.';
  }

  if (personaGenerationError) {
    return 'Persona generation hit an error.';
  }

  if (generatedCount > 0) {
    return `${generatedCount} of ${personaCount} personas ready to choose.`;
  }

  return 'Choose one persona for the simulation.';
}

function getResultsSummary(
  resultSummary: ValidationResultSummary | null,
  runState: WorkspaceRunState
) {
  if (runState.status === 'running') {
    return 'Simulation run in progress.';
  }

  if (runState.status === 'error') {
    return runState.error || 'Simulation run hit an error.';
  }

  const completedCount =
    resultSummary?.selectedTests.filter((test) => test.status === 'completed').length || 0;

  if (completedCount > 0) {
    return `${completedCount} result${completedCount === 1 ? '' : 's'} ready to review.`;
  }

  return 'Results will open here after the simulation runs.';
}

function getRunStatusMessage({
  canRun,
  currentStage,
  generatedCount,
  hasCompletedResults,
  hasPendingPersonaRegenerationDecision,
  hasPersonasForCurrentCount,
  personaCount,
  requiresPersonaRegeneration,
  runState,
  selectedCount,
  selectedPersona,
}: {
  canRun: boolean;
  currentStage: string;
  generatedCount: number;
  hasCompletedResults: boolean;
  hasPendingPersonaRegenerationDecision: boolean;
  hasPersonasForCurrentCount: boolean;
  personaCount: number;
  requiresPersonaRegeneration: boolean;
  runState: WorkspaceRunState;
  selectedCount: number;
  selectedPersona: GeneratedPersona | null;
}) {
  if (runState.status === 'running') {
    return currentStage;
  }

  if (runState.status === 'error') {
    return runState.error || 'Simulation run failed.';
  }

  if (hasPendingPersonaRegenerationDecision) {
    return 'Answer the regenerate-personas prompt before running the simulation.';
  }

  if (requiresPersonaRegeneration) {
    return 'Generate personas again from the latest context before running.';
  }

  if (generatedCount === 0) {
    return 'Generate personas before running the simulation.';
  }

  if (!hasPersonasForCurrentCount) {
    return `Generate ${personaCount} personas to match the current count before running.`;
  }

  if (!selectedPersona) {
    return 'Choose one generated persona to unlock the simulation.';
  }

  if (selectedCount === 0) {
    return 'Return to Decide Tests and select at least one validation check.';
  }

  if (canRun) {
    return `Ready to run ${selectedCount} selected test${selectedCount === 1 ? '' : 's'} as ${selectedPersona.name}.`;
  }

  if (hasCompletedResults) {
    return 'Latest results are available below. Reopen tests if you want to queue another simulation.';
  }

  return 'Project assets on the left still need to be ready before you can run the simulation.';
}

function getPersonaInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function PersonaGenerationLoadingState() {
  return (
    <div className="flex min-h-[280px] w-full flex-col items-center justify-start px-4 pt-2 pb-1">
      <div className="flex h-[148px] w-full max-w-[220px] items-center justify-center">
        <DotLottieReact
          autoplay
          loop
          src="/animations/personas.lottie"
          className="h-full w-full"
        />
      </div>
      <p className="mt-1 text-base font-medium">Generating personas</p>
      <div className="mt-1.5 flex items-center justify-center gap-2">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2.5 w-2.5 rounded-full bg-foreground/50 animate-pulse"
            style={{
              animationDelay: `${dot * 0.22}s`,
              animationDuration: '0.9s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  Accessibility,
  ArrowLeft,
  Copy,
  Download,
  Expand,
  FileSearch,
  Hand,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  ResultActionPriority,
  ResultActionableChange,
  ResultNarrativeBlocks,
  ValidationProgressStep,
  ValidationResultTestSummary,
  ValidationResultSummary,
  WorkspaceRunState,
} from '@/lib/types';

interface ResultsPanelProps {
  progressSteps: ValidationProgressStep[];
  resultSummary: ValidationResultSummary | null;
  resultsPersonaBadge?: string | null;
  runState: WorkspaceRunState;
  onOpenExpandedReader: () => void;
  onOpenTestReport: (testId: ValidationResultTestSummary['id']) => void;
}

export function ResultsPanel({
  progressSteps,
  resultSummary,
  resultsPersonaBadge,
  runState,
  onOpenExpandedReader,
  onOpenTestReport,
}: ResultsPanelProps) {
  const hasCompletedResults = Boolean(
    resultSummary?.selectedTests.some((test) => test.status === 'completed')
  );

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="min-h-[64px] justify-center border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Results</CardTitle>
            {resultsPersonaBadge ? (
              <p className="mt-1 inline-flex rounded-full border border-[#C26A43]/35 bg-[#F6E4D9] px-2.5 py-1 text-[10px] font-medium text-[#8E4524]">
                {resultsPersonaBadge}
              </p>
            ) : null}
          </div>
          {hasCompletedResults ? (
            <button
              type="button"
              onClick={onOpenExpandedReader}
              className="flex items-center gap-1.5 rounded-full border border-border/55 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-white"
            >
              <Expand className="h-3.5 w-3.5" />
              View Full Report
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          'min-h-0 flex-1 px-4 py-3',
          runState.status === 'running' ? 'overflow-hidden' : 'overflow-y-auto'
        )}
      >
        {runState.status === 'running' ? (
          <RunningResultsState
            hasCompletedResults={hasCompletedResults}
            progressSteps={progressSteps}
          />
        ) : null}

        {runState.status === 'error' ? (
          <ErrorResultsState message={runState.error} />
        ) : null}

        {resultSummary && hasCompletedResults ? (
          <CompletedResultsState
            onOpenTestReport={onOpenTestReport}
            resultSummary={resultSummary}
          />
        ) : null}

        {runState.status === 'idle' && !hasCompletedResults ? <EmptyResultsState /> : null}
      </CardContent>
    </Card>
  );
}

export function TestReportReaderOverlay({
  onClose,
  test,
}: {
  onClose: () => void;
  test: ValidationResultTestSummary;
}) {
  return (
    <OverlayShell className="p-4 sm:p-6" onClose={onClose}>
      <div className="mx-auto flex h-full w-full max-w-2xl items-start justify-center">
        <ReportReaderSurface isExpanded={false} onClose={onClose} test={test} />
      </div>
    </OverlayShell>
  );
}

export function ExpandedResultsReaderSurface({
  activeTest,
  onClose,
  onSelectTest,
  resultSummary,
}: {
  activeTest: ValidationResultTestSummary;
  onClose: () => void;
  onSelectTest: (testId: ValidationResultTestSummary['id']) => void;
  resultSummary: ValidationResultSummary;
}) {
  return (
    <ReportReaderSurface
      activeTest={activeTest}
      isExpanded
      onClose={onClose}
      onSelectTest={onSelectTest}
      resultSummary={resultSummary}
      test={activeTest}
    />
  );
}

export function getPreferredResultTest(
  tests: ValidationResultTestSummary[]
): ValidationResultTestSummary | null {
  const completedTests = tests.filter((test) => test.status === 'completed');

  if (completedTests.length === 0) {
    return null;
  }

  return completedTests
    .slice()
    .sort((left, right) => (right.score || 0) - (left.score || 0))[0];
}

function EmptyResultsState() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <div className="max-w-sm space-y-2.5 text-center">
        <p className="text-sm font-medium">No results yet</p>
        <p className="text-[13px] leading-5 text-muted-foreground">
          Select tests and run the simulation to view results here.
        </p>
      </div>
    </div>
  );
}

function RunningResultsState({
  hasCompletedResults,
  progressSteps: _progressSteps,
}: {
  hasCompletedResults: boolean;
  progressSteps: ValidationProgressStep[];
}) {
  const statusMessages = [
    'Running Simulation',
    'Chat with Ascala',
    'Come Back in a Moment',
  ];
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveMessageIndex((currentIndex) =>
        (currentIndex + 1) % statusMessages.length
      );
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [statusMessages.length]);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col',
        hasCompletedResults ? 'gap-3 pb-3' : 'h-full items-center justify-center'
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5 px-4 py-2">
        <div className="flex h-[142px] w-full max-w-[220px] items-center justify-center sm:h-[156px] sm:max-w-[232px]">
          <DotLottieReact
            autoplay
            loop
            src="/animations/simulation.lottie"
            className="h-full w-full"
          />
        </div>
        <p className="text-center text-[15px] font-medium leading-5">
          {statusMessages[activeMessageIndex]}
        </p>
        <div className="flex items-center justify-center gap-2">
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
    </div>
  );
}

function CompletedResultsState({
  resultSummary,
  onOpenTestReport,
}: {
  resultSummary: ValidationResultSummary;
  onOpenTestReport: (testId: ValidationResultTestSummary['id']) => void;
}) {
  const completedTests = resultSummary.selectedTests.filter(
    (test) => test.status === 'completed'
  );

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border/55 bg-white/42 px-3 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overall score
            </p>
            <ScoreRing score={resultSummary.overallScore} label="Overall score" />
          </div>

          {completedTests.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              {completedTests.map((test) => (
                <InlineTestScoreRow
                  key={test.id}
                  onOpen={onOpenTestReport}
                  test={test}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InlineTestScoreRow({
  test,
  onOpen,
}: {
  test: ValidationResultTestSummary;
  onOpen: (testId: ValidationResultTestSummary['id']) => void;
}) {
  const Icon = getTestIcon(test.id);

  return (
    <button
      type="button"
      onClick={() => onOpen(test.id)}
      disabled={test.status !== 'completed'}
      className={cn(
        'flex min-w-[168px] items-center justify-between gap-3 rounded-xl border border-border/45 bg-white/55 px-2.5 py-2 text-left transition-colors',
        test.status === 'completed'
          ? 'hover:bg-white/80'
          : 'cursor-default text-muted-foreground/70'
      )}
      aria-label={
        test.status === 'completed'
          ? `Open ${test.label} report`
          : `${test.label} has not been run yet`
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white/80 text-foreground shadow-sm">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="truncate text-[12px] font-medium">{test.label}</p>
      </div>
      <div className="shrink-0 text-[11px] font-semibold text-foreground/80">
        {test.status === 'completed' && typeof test.score === 'number'
          ? `${test.score}/100`
          : 'Pending'}
      </div>
    </button>
  );
}

function OverlayShell({
  children,
  className,
  onClose,
}: {
  children: ReactNode;
  className?: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn('fixed inset-0 z-50 bg-[rgba(45,33,22,0.18)]', className)}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function ReportReaderSurface({
  activeTest,
  isExpanded,
  onClose,
  onSelectTest,
  resultSummary,
  test,
}: {
  activeTest?: ValidationResultTestSummary;
  isExpanded: boolean;
  onClose: () => void;
  onSelectTest?: (testId: ValidationResultTestSummary['id']) => void;
  resultSummary?: ValidationResultSummary;
  test: ValidationResultTestSummary;
}) {
  const Icon = getTestIcon(test.id);

  return (
    <div
      className={cn(
        'flex max-h-full w-full flex-col overflow-hidden rounded-[30px] border border-border/50 bg-[rgba(252,248,242,0.96)] shadow-[0_28px_80px_-32px_rgba(52,38,23,0.45)] backdrop-blur-md',
        isExpanded ? 'h-full' : 'max-w-2xl'
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-full border border-border/55 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white/75 shadow-sm">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {isExpanded ? 'Expanded results' : 'Test report'}
            </p>
            <p className="text-sm font-semibold">{test.label}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          {isExpanded && resultSummary ? (
            <ExpandedReaderOverview
              activeTest={activeTest || test}
              onSelectTest={onSelectTest}
              resultSummary={resultSummary}
            />
          ) : null}

          <section className="flex items-end justify-between gap-4 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Test score
              </p>
              <ScoreRing score={test.score || 0} label="Test score" />
            </div>
            <button
              type="button"
              onClick={() => exportWorkingChecklist(test)}
              className="flex items-center gap-2 rounded-full border border-border/55 bg-white/80 px-3 py-1.5 text-[11px] text-foreground shadow-sm transition-colors hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export working checklist
            </button>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[13px] font-semibold">Summary</h3>
            <p className="text-[13px] leading-6 text-muted-foreground">
              {test.summary}
            </p>
          </section>

          <NarrativeBlocksSection narrative={test} />
        </div>
      </div>
    </div>
  );
}

function ExpandedReaderOverview({
  activeTest,
  onSelectTest,
  resultSummary,
}: {
  activeTest: ValidationResultTestSummary;
  onSelectTest?: (testId: ValidationResultTestSummary['id']) => void;
  resultSummary: ValidationResultSummary;
}) {
  return (
    <section className="space-y-4 border-b border-border/50 pb-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overall score
          </p>
          <ScoreRing score={resultSummary.overallScore} label="Overall score" />
        </div>
        <p className="max-w-md text-right text-[12px] leading-5 text-muted-foreground">
          Enlarged reading mode for the current validation output. The selected test report
          stays in focus while the workspace remains underneath.
        </p>
      </div>

      <section className="space-y-1.5">
        <h3 className="text-[13px] font-semibold">Overall summary</h3>
        <p className="text-[13px] leading-6 text-muted-foreground">
          {resultSummary.summary}
        </p>
      </section>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold">Selected tests</h3>
          <p className="text-[11px] text-muted-foreground">Choose a report to read</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resultSummary.selectedTests.map((test) => {
            const Icon = getTestIcon(test.id);

            return (
              <button
                key={test.id}
                type="button"
                onClick={() => onSelectTest?.(test.id)}
                disabled={test.status !== 'completed'}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-2 text-left shadow-sm transition-colors',
                  test.id === activeTest.id
                    ? 'border-primary/30 bg-white text-foreground'
                    : test.status === 'completed'
                      ? 'border-border/55 bg-white/70 text-muted-foreground hover:bg-white'
                      : 'cursor-default border-border/45 bg-white/45 text-muted-foreground/70'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[12px] font-medium">{test.label}</span>
                <span className="text-[11px]">
                  {test.status === 'completed' && typeof test.score === 'number'
                    ? `${test.score}/100`
                    : 'Pending'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function NarrativeBlocksSection({
  narrative,
}: {
  narrative: Pick<
    ResultNarrativeBlocks,
    'quotes' | 'actionableChanges' | 'keyInsights'
  >;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Persona quotes
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <QuoteCard
            label="Positive"
            quote={narrative.quotes.positive}
            tone="positive"
          />
          <QuoteCard
            label="Negative"
            quote={narrative.quotes.negative}
            tone="negative"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Actionable changes
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {narrative.actionableChanges.map((change) => (
            <ActionableChangeCard key={change.priority} change={change} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Key insights
        </p>
        <div className="space-y-2">
          {narrative.keyInsights.map((insight, index) => (
            <div
              key={`${index}-${insight}`}
              className="flex gap-2 rounded-2xl border border-border/45 bg-white/55 px-3 py-2.5"
            >
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/45" />
              <p className="text-[12px] leading-5 text-muted-foreground">{insight}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteCard({
  label,
  quote,
  tone,
}: {
  label: string;
  quote: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <section
      className={cn(
        'rounded-[24px] border px-3 py-3',
        tone === 'positive'
          ? 'border-[rgba(34,197,94,0.5)] bg-[rgba(240,253,244,0.92)]'
          : 'border-[rgba(239,68,68,0.45)] bg-[rgba(254,242,242,0.9)]'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[13px] leading-6 text-foreground/85">
        {formatQuoteText(quote)}
      </p>
    </section>
  );
}

function ActionableChangeCard({
  change,
}: {
  change: ResultActionableChange;
}) {
  const handleCopyImplementationPrompt = async () => {
    const prompt = buildImplementationPrompt(change);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      }
    } catch {
      // no-op fallback for environments that block clipboard writes
    }
  };

  return (
    <section className={cn('rounded-[24px] border bg-white/55 px-3 py-3', getPriorityBorderClass(change.priority))}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', getPriorityDotClass(change.priority))} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {formatPriorityLabel(change.priority)}
        </p>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{change.text}</p>
      <button
        type="button"
        onClick={handleCopyImplementationPrompt}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/55 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-white"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy implementation prompt
      </button>
      <button
        type="button"
        onClick={handleCopyImplementationPrompt}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#C26A43]/45 bg-[#C26A43] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-[#B95F39]"
      >
        Send to my coding agent
      </button>
    </section>
  );
}

function buildImplementationPrompt(change: ResultActionableChange) {
  return [
    'Implement this UX improvement in the app:',
    `Priority: ${formatPriorityLabel(change.priority)}`,
    `Requested change: ${change.text}`,
    'Return exactly:',
    '1) files changed',
    '2) implementation summary',
    '3) test plan',
  ].join('\n');
}

function exportWorkingChecklist(test: ValidationResultTestSummary) {
  const checklistLines = [
    `${test.label} - Working checklist`,
    '',
    `Summary: ${test.summary}`,
    '',
    'Actionable changes:',
    ...test.actionableChanges.map(
      (change, index) =>
        `${index + 1}. [${formatPriorityLabel(change.priority)}] ${change.text}`
    ),
    '',
    'Key insights:',
    ...test.keyInsights.map((insight, index) => `${index + 1}. ${insight}`),
  ];
  const content = checklistLines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${test.id}-working-checklist.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function formatQuoteText(quote: string) {
  const trimmed = quote.trim();

  if (!trimmed) {
    return '';
  }

  return /^["'].+["']$/.test(trimmed) ? trimmed : `"${trimmed}"`;
}

function formatPriorityLabel(priority: ResultActionPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getPriorityDotClass(priority: ResultActionPriority) {
  switch (priority) {
    case 'urgent':
      return 'bg-[rgba(208,108,72,0.9)]';
    case 'important':
      return 'bg-[rgba(216,164,74,0.95)]';
    case 'later':
      return 'bg-[rgba(132,142,158,0.9)]';
    default:
      return 'bg-foreground/45';
  }
}

function ScoreRing({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const progressAngle = Math.round((normalizedScore / 100) * 360);

  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(rgba(194,106,67,0.95) ${progressAngle}deg, rgba(214,204,191,0.45) ${progressAngle}deg 360deg)`,
      }}
      role="img"
      aria-label={`${label}: ${normalizedScore} out of 100`}
    >
      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-border/45 bg-[rgba(252,248,242,0.98)] shadow-sm">
        <span className="text-[18px] font-semibold leading-none">{normalizedScore}</span>
        <span className="mt-0.5 text-[9px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function getPriorityBorderClass(priority: ResultActionPriority) {
  switch (priority) {
    case 'urgent':
      return 'border-[rgba(208,108,72,0.65)]';
    case 'important':
      return 'border-[rgba(216,164,74,0.7)]';
    case 'later':
      return 'border-[rgba(132,142,158,0.7)]';
    default:
      return 'border-border/45';
  }
}

function getTestIcon(testId: ValidationResultTestSummary['id']) {
  switch (testId) {
    case 'engagement-habit-formation':
      return TrendingUp;
    case 'activation':
      return Zap;
    case 'onboarding':
      return Rocket;
    case 'accessibility':
      return Accessibility;
    case 'compliance':
      return ShieldCheck;
    case 'thumb-zones':
      return Hand;
    default:
      return FileSearch;
  }
}

function ErrorResultsState({
  message,
}: {
  message?: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50/80 px-3.5 py-3">
      <p className="text-[13px] font-semibold text-red-800">Validation could not complete</p>
      <p className="text-[13px] leading-5 text-red-700">
        {message || 'An unexpected error interrupted the run.'}
      </p>
    </div>
  );
}

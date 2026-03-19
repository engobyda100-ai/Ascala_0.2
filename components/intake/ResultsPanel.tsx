import type { ReactNode } from 'react';
import {
  Accessibility,
  ArrowLeft,
  Expand,
  FileSearch,
  Rocket,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  ValidationProgressStep,
  ValidationResultTestSummary,
  ValidationResultSummary,
  WorkspaceRunState,
} from '@/lib/types';

interface ResultsPanelProps {
  progressSteps: ValidationProgressStep[];
  resultSummary: ValidationResultSummary | null;
  runState: WorkspaceRunState;
  onOpenExpandedReader: () => void;
  onOpenTestReport: (testId: ValidationResultTestSummary['id']) => void;
}

export function ResultsPanel({
  progressSteps,
  resultSummary,
  runState,
  onOpenExpandedReader,
  onOpenTestReport,
}: ResultsPanelProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="border-b border-border/60 px-4 pb-2 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Results</CardTitle>
          {runState.status === 'success' &&
          resultSummary &&
          resultSummary.selectedTests.some((test) => test.status === 'completed') ? (
            <button
              type="button"
              onClick={onOpenExpandedReader}
              className="flex items-center gap-1.5 rounded-full border border-border/55 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-white"
            >
              <Expand className="h-3.5 w-3.5" />
              Expand
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {runState.status === 'running' ? (
          <RunningResultsState progressSteps={progressSteps} />
        ) : null}

        {runState.status === 'error' ? (
          <ErrorResultsState message={runState.error} />
        ) : null}

        {runState.status === 'success' && resultSummary ? (
          <CompletedResultsState
            onOpenTestReport={onOpenTestReport}
            resultSummary={resultSummary}
          />
        ) : null}

        {runState.status === 'idle' ? <EmptyResultsState /> : null}
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

export function getPreferredResultTest(tests: ValidationResultTestSummary[]) {
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
          Select tests and click Run Tests to view results here.
        </p>
      </div>
    </div>
  );
}

function RunningResultsState({
  progressSteps,
}: {
  progressSteps: ValidationProgressStep[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Validation in progress</p>
        <p className="text-[13px] leading-5 text-muted-foreground">
          Ascala is building the first pass of the output summary in place. Results
          will stay anchored here as the run advances.
        </p>
      </div>

      <div className="space-y-2.5">
        {progressSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                step.status === 'complete' && 'bg-emerald-500',
                step.status === 'active' && 'animate-pulse bg-primary',
                step.status === 'pending' && 'bg-muted-foreground/30'
              )}
            />
            <div className="flex-1 border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
              <p className="text-[13px] font-medium">{step.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {step.status === 'complete'
                  ? 'Completed'
                  : step.status === 'active'
                    ? 'In progress'
                    : 'Waiting'}
              </p>
            </div>
          </div>
        ))}
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
  return (
    <div className="space-y-4">
      <section className="flex items-end justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overall score
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {resultSummary.overallScore}
            <span className="ml-1 text-base text-muted-foreground">/100</span>
          </p>
        </div>
        <p className="max-w-[160px] text-right text-[12px] leading-5 text-muted-foreground">
          Compact output summary from the current selected validation set.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[13px] font-semibold">Summary</h3>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {resultSummary.summary}
        </p>
      </section>

      {resultSummary.selectedTests.length > 0 ? (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold">Selected tests</h3>
            <p className="text-[11px] text-muted-foreground">Use the icon to open</p>
          </div>
          <div className="space-y-2">
            {resultSummary.selectedTests.map((test) => (
              <CompactTestResultRow
                key={test.id}
                onOpen={onOpenTestReport}
                test={test}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-1.5">
        <h3 className="text-[13px] font-semibold">Top findings</h3>
        <div className="space-y-2.5">
          {resultSummary.topFindings.map((item) => (
            <div key={item.title} className="border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
              <p className="text-[13px] font-medium">{item.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[13px] font-semibold">Top recommendations</h3>
        <div className="space-y-2.5">
          {resultSummary.topRecommendations.map((item) => (
            <div key={item.title} className="border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
              <p className="text-[13px] font-medium">{item.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompactTestResultRow({
  test,
  onOpen,
}: {
  test: ValidationResultTestSummary;
  onOpen: (testId: ValidationResultTestSummary['id']) => void;
}) {
  const Icon = getTestIcon(test.id);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/45 bg-white/42 px-2.5 py-2">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={() => onOpen(test.id)}
          disabled={test.status !== 'completed'}
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-foreground shadow-sm transition-colors',
            test.status === 'completed'
              ? 'border-border/60 bg-white/80 hover:bg-white'
              : 'cursor-default border-border/45 bg-white/45 text-muted-foreground/70'
          )}
          aria-label={
            test.status === 'completed'
              ? `Open ${test.label} report`
              : `${test.label} has not been run yet`
          }
        >
          <Icon className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{test.label}</p>
          <p className="mt-0.5 truncate text-[12px] leading-5 text-muted-foreground">
            {test.summary || (test.status === 'pending' ? 'Pending run' : 'Ready')}
          </p>
        </div>
      </div>
      <div className="shrink-0 rounded-full border border-border/60 px-2 py-1 text-[11px] font-semibold text-foreground/80">
        {test.status === 'completed' && typeof test.score === 'number'
          ? `${test.score}/100`
          : 'Pending'}
      </div>
    </div>
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
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Test score
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {test.score || 0}
                <span className="ml-1 text-base text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/55 bg-white/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
              <FileSearch className="h-3.5 w-3.5" />
              Ready for review
            </div>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-[13px] font-semibold">Summary</h3>
            <p className="text-[13px] leading-6 text-muted-foreground">
              {test.summary}
            </p>
          </section>

          <ResultDetailList items={test.keyFindings} title="Key findings" />
          <ResultDetailList
            items={test.recommendations}
            title="Recommendations"
          />
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
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overall score
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {resultSummary.overallScore}
            <span className="ml-1 text-base text-muted-foreground">/100</span>
          </p>
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

function ResultDetailList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex gap-2 rounded-2xl border border-border/45 bg-white/55 px-3 py-2.5"
          >
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <p className="text-[12px] leading-5 text-muted-foreground">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getTestIcon(testId: ValidationResultTestSummary['id']) {
  switch (testId) {
    case 'engagement-habit-formation':
      return TrendingUp;
    case 'onboarding':
      return Rocket;
    case 'accessibility':
      return Accessibility;
    case 'compliance':
      return ShieldCheck;
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

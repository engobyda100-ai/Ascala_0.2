import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  ValidationTestDefinition,
  ValidationTestGroup,
  ValidationTestId,
  WorkspaceRunState,
} from '@/lib/types';

interface ValidationPanelProps {
  groups: ValidationTestGroup[];
  completedTestIds: ValidationTestId[];
  pendingTestIds: ValidationTestId[];
  selectedTestIds: ValidationTestId[];
  currentStage: string;
  runState: WorkspaceRunState;
  canRun: boolean;
  onRun: () => void;
  onToggleTest: (testId: ValidationTestId) => void;
}

export function ValidationPanel({
  completedTestIds,
  groups,
  pendingTestIds,
  selectedTestIds,
  currentStage,
  runState,
  canRun,
  onRun,
  onToggleTest,
}: ValidationPanelProps) {
  const totalTests = groups.reduce((sum, group) => sum + group.tests.length, 0);
  const completedCount = completedTestIds.length;
  const pendingCount = pendingTestIds.length;
  const selectedCount = selectedTestIds.length;
  const isRunning = runState.status === 'running';
  const canExecute = canRun && selectedCount > 0 && !isRunning;
  const showGroupTitle = groups.length > 1;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="border-b border-border/45 px-4 pb-2 pt-3">
        <CardTitle className="text-base font-semibold">Validation Suite</CardTitle>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {selectedCount} of {totalTests} tests selected
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-2.5">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <h3 className="text-[13px] font-semibold">Select validation tests</h3>
            </div>
            {groups.map((group) => (
              <section key={group.id} className="space-y-1">
                {showGroupTitle ? (
                  <div>
                    <h3 className="text-[12px] font-semibold">{group.label}</h3>
                  </div>
                ) : null}
                <div className="overflow-hidden rounded-2xl bg-white/28">
                  {group.tests.map((test, index) => {
                    const isSelected = selectedTestIds.includes(test.id);
                    const isDisabled = isRunning;

                    return (
                      <ValidationToggleRow
                        key={test.id}
                        test={test}
                        isCompleted={completedTestIds.includes(test.id)}
                        isPending={pendingTestIds.includes(test.id)}
                        isSelected={isSelected}
                        isLast={index === group.tests.length - 1}
                        onToggle={onToggleTest}
                        isDisabled={isDisabled}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <section className="space-y-1 border-t border-border/45 pt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">
                {isRunning
                  ? currentStage
                  : runState.status === 'success'
                    ? 'Latest run completed'
                  : runState.status === 'error'
                      ? runState.error
                      : pendingCount > 0
                        ? `${pendingCount} pending · ${completedCount} completed`
                        : selectedCount > 0
                          ? `${completedCount} completed`
                        : 'Select at least one test'}
              </p>
            </div>
            <Button onClick={onRun} disabled={!canExecute} size="sm" className="h-8 rounded-full px-4 text-xs shadow-sm">
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </>
              ) : (
                <>Run Tests</>
              )}
            </Button>
          </div>
          {runState.lastRunAt ? (
            <p className="text-[10px] text-muted-foreground">
              Last completed run: {runState.lastRunAt}
            </p>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

function ValidationToggleRow({
  test,
  isCompleted,
  isPending,
  isSelected,
  isDisabled,
  isLast,
  onToggle,
}: {
  test: ValidationTestDefinition;
  isCompleted: boolean;
  isPending: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isLast: boolean;
  onToggle: (testId: ValidationTestId) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 transition-colors',
        !isLast && 'mb-1',
        isSelected ? 'bg-white/72 shadow-sm ring-1 ring-primary/10' : 'bg-white/42',
        isDisabled && !isSelected && 'opacity-60'
      )}
    >
      <div className="min-w-0 pr-2">
        <p className="text-[13px] font-medium leading-5">{test.label}</p>
        {isSelected ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isPending ? 'Pending run' : isCompleted ? 'Completed' : 'Selected'}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isSelected}
        aria-label={test.label}
        disabled={isDisabled}
        onClick={() => onToggle(test.id)}
        className={cn(
          'relative h-7 w-12 rounded-full border transition-colors',
          isSelected ? 'border-primary/70 bg-primary' : 'border-border/55 bg-white/75',
          isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            isSelected && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

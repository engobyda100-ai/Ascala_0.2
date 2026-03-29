import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  showExecutionFooter?: boolean;
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
  showExecutionFooter = true,
  onRun,
  onToggleTest,
}: ValidationPanelProps) {
  const completedCount = completedTestIds.length;
  const pendingCount = pendingTestIds.length;
  const selectedCount = selectedTestIds.length;
  const isRunning = runState.status === 'running';
  const canExecute = canRun && selectedCount > 0 && !isRunning;
  const showGroupTitle = groups.length > 1;
  const [customTestDraft, setCustomTestDraft] = useState('');
  const tokenCost = selectedCount * 4;

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardContent className="flex flex-col gap-2 px-4 py-3">
        <div className="pr-1">
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
                <div className="grid grid-cols-1 gap-2 rounded-2xl bg-white/28 p-2">
                  {group.tests.map((test) => {
                    const isSelected = selectedTestIds.includes(test.id);
                    const isDisabled = isRunning;

                    return (
                      <ValidationToggleRow
                        key={test.id}
                        test={test}
                        isCompleted={completedTestIds.includes(test.id)}
                        isPending={pendingTestIds.includes(test.id)}
                        isSelected={isSelected}
                        onToggle={onToggleTest}
                        isDisabled={isDisabled}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border border-border/45 bg-white/32 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pr-1">
                  <p className="text-[13px] font-semibold leading-4">
                    Create your own{' '}
                    <span className="font-medium text-muted-foreground">[Coming soon]</span>
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={false}
                  aria-label="Create your own coming soon"
                  disabled
                  className={cn(
                    'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border border-border/35 bg-white/45 shadow-[0_6px_16px_-10px_rgba(61,23,0,0.45)] opacity-60'
                  )}
                >
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <div className="relative mt-1.5">
                <Input
                  value={customTestDraft}
                  onChange={(event) => setCustomTestDraft(event.target.value)}
                  placeholder="Describe a custom validation test"
                  className="h-9 border-border/50 bg-white/82 px-3 text-sm"
                />
              </div>
            </section>
          </div>
        </div>

        {showExecutionFooter ? (
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
                            ? `${selectedCount} selected`
                          : 'Select at least one test'}
                </p>
              </div>
              <Button
                onClick={onRun}
                disabled={!canExecute}
                size="sm"
                className="h-8 min-w-[154px] rounded-full bg-[#3D1700] px-4 text-xs text-white shadow-sm hover:bg-[#3D1700]/90"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Running
                  </>
                ) : (
                  <>Run Tests = {tokenCost} tokens</>
                )}
              </Button>
            </div>
            {runState.lastRunAt ? (
              <p className="text-[10px] text-muted-foreground">
                Last completed run: {runState.lastRunAt}
              </p>
            ) : null}
          </section>
        ) : null}
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
  onToggle,
}: {
  test: ValidationTestDefinition;
  isCompleted: boolean;
  isPending: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (testId: ValidationTestId) => void;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[60px] items-start justify-between gap-4 rounded-2xl px-3.5 py-2.5 shadow-[0_12px_24px_-22px_rgba(61,23,0,0.45)] transition-colors',
        isSelected
          ? 'bg-white/78 shadow-[0_14px_30px_-24px_rgba(68,48,29,0.72)] ring-1 ring-[#3D1700]/10'
          : 'bg-white/20 opacity-80',
        isDisabled && !isSelected && 'opacity-60'
      )}
    >
      <div className="min-w-0 flex-1 pr-4">
        <p
          className={cn(
            'text-[13px] font-medium leading-3.5',
            isSelected ? 'text-foreground' : 'text-foreground'
          )}
        >
          {test.label}
        </p>
        <p
          className={cn(
            'mt-0.5 text-[10px] leading-3',
            isSelected ? 'text-muted-foreground' : 'text-muted-foreground/75'
          )}
        >
          {isSelected
            ? isPending
              ? 'Pending run'
              : isCompleted
                ? 'Completed'
                : 'Selected'
            : 'Not selected'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isSelected}
        aria-label={test.label}
        disabled={isDisabled}
        onClick={() => onToggle(test.id)}
        className={cn(
          'relative ml-1 mt-0.5 h-6 w-11 shrink-0 rounded-full border shadow-[0_6px_16px_-10px_rgba(61,23,0,0.45)] transition-colors',
          isSelected
            ? 'border-[#3D1700]/70 bg-[#3D1700]'
            : 'border-border/35 bg-white/45',
          isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            isSelected && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

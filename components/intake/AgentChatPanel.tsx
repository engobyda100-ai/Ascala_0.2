import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  VALIDATION_TEST_CATALOG,
  type ChatAgentMode,
  type IntakeChatMessage,
  type ValidationTestId,
} from '@/lib/types';

interface AgentChatPanelProps {
  appUrl: string;
  checkedChecklistItems: string[];
  intakeSignalCount: number;
  uploadedFileCount: number;
  draftMessage: string;
  isResponding: boolean;
  messages: IntakeChatMessage[];
  mode: ChatAgentMode;
  onApplyRecommendedTests: (testIds: ValidationTestId[]) => void;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onToggleChecklistItem: (item: string) => void;
  selectedTestIds: ValidationTestId[];
}

export function AgentChatPanel({
  appUrl,
  checkedChecklistItems,
  intakeSignalCount,
  uploadedFileCount,
  draftMessage,
  isResponding,
  messages,
  mode,
  onApplyRecommendedTests,
  onDraftChange,
  onSendMessage,
  onToggleChecklistItem,
  selectedTestIds,
}: AgentChatPanelProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const modeLabel = getModeLabel(mode);
  const helperLine = 'Press Enter to send. Use Shift+Enter for a new line.';

  useEffect(() => {
    const thread = threadRef.current;

    if (!thread) {
      return;
    }

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: 'smooth',
    });
  }, [isResponding, messages.length]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border-border/45 bg-white/58 shadow-[0_18px_40px_-28px_rgba(68,48,29,0.55)] backdrop-blur-sm">
      <CardHeader className="border-b border-border/45 px-6 pb-2 pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-[11px] font-medium text-muted-foreground">Online</span>
            </div>
            <CardTitle className="text-base font-semibold">ASCALA Intake Agent</CardTitle>
          </div>
          <div className="text-right text-[11px] leading-4 text-muted-foreground">
            <p>{isResponding ? 'Coach is thinking' : modeLabel}</p>
            <p>{appUrl ? 'App URL loaded' : 'Waiting for app URL'}</p>
            <p>{uploadedFileCount > 0 ? `${uploadedFileCount} file${uploadedFileCount === 1 ? '' : 's'} attached` : 'No files attached'}</p>
            <p>{intakeSignalCount > 0 ? `${intakeSignalCount} intake signal${intakeSignalCount === 1 ? '' : 's'} captured` : 'Building product understanding from chat'}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div
          ref={threadRef}
          className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className="max-w-[85%] space-y-1.5">
                <div
                  className={cn(
                    'rounded-3xl px-4 py-3.5 shadow-sm',
                    message.role === 'user'
                      ? 'rounded-br-lg bg-primary text-primary-foreground'
                      : 'rounded-bl-lg border border-border/45 bg-white/80'
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.role === 'assistant' && message.coachPayload ? (
                    <CoachMessageSections
                      checkedChecklistItems={checkedChecklistItems}
                      coachPayload={message.coachPayload}
                      onApplyRecommendedTests={onApplyRecommendedTests}
                      onToggleChecklistItem={onToggleChecklistItem}
                      selectedTestIds={selectedTestIds}
                    />
                  ) : null}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2 px-1 text-[11px]',
                    message.role === 'user'
                      ? 'justify-end text-primary/70'
                      : 'justify-start text-muted-foreground'
                  )}
                >
                  <span className="font-medium">
                    {message.role === 'user' ? 'You' : 'ASCALA'}
                  </span>
                  <span>{message.timestamp}</span>
                </div>
              </div>
            </article>
          ))}

          {isResponding ? (
            <article className="flex justify-start">
              <div className="max-w-[85%] space-y-1.5">
                <div className="rounded-3xl rounded-bl-lg border border-border/45 bg-white/78 px-4 py-3.5 shadow-sm">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Thinking through the sharpest next move...
                  </p>
                </div>
                <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                  <span className="font-medium">ASCALA</span>
                  <span>Now</span>
                </div>
              </div>
            </article>
          ) : null}
        </div>

        <form
          className="space-y-3 border-t border-border/45 bg-white/34 px-6 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSendMessage();
          }}
        >
          <Textarea
            id="agentMessage"
            value={draftMessage}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !isResponding) {
                event.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="Describe the product, share important context from uploaded assets, or ask which validation tests Ascala should run next."
            className="min-h-[108px] resize-none rounded-[22px] border-border/45 bg-white/72 px-4 py-3 shadow-sm"
          />
          <div className="flex items-start justify-between gap-3">
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              {helperLine}
            </p>
            <Button
              type="submit"
              disabled={!draftMessage.trim() || isResponding}
              className="rounded-full px-5 shadow-sm"
            >
              {isResponding ? 'Thinking…' : 'Send'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CoachMessageSections({
  checkedChecklistItems,
  coachPayload,
  onApplyRecommendedTests,
  onToggleChecklistItem,
  selectedTestIds,
}: {
  checkedChecklistItems: string[];
  coachPayload: NonNullable<IntakeChatMessage['coachPayload']>;
  onApplyRecommendedTests: (testIds: ValidationTestId[]) => void;
  onToggleChecklistItem: (item: string) => void;
  selectedTestIds: ValidationTestId[];
}) {
  const recommendedTestIds = coachPayload.recommendedTestIds || [];
  const hasUnappliedRecommendations = recommendedTestIds.some(
    (testId) => !selectedTestIds.includes(testId)
  );

  if (
    !coachPayload.nextAction &&
    recommendedTestIds.length === 0 &&
    (coachPayload.insightHighlights || []).length === 0 &&
    (coachPayload.checklistItems || []).length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border/45 pt-3">
      {coachPayload.nextAction ? (
        <section className="rounded-[18px] border border-border/45 bg-white/68 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Next action
          </p>
          <p className="mt-1 text-[13px] leading-5 text-foreground/90">
            {coachPayload.nextAction}
          </p>
        </section>
      ) : null}

      {recommendedTestIds.length > 0 ? (
        <section className="rounded-[18px] border border-border/45 bg-white/60 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Recommended tests
              </p>
              <p className="mt-1 text-[13px] leading-5 text-foreground/90">
                {recommendedTestIds.map(getValidationTestLabel).join(', ')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onApplyRecommendedTests(recommendedTestIds)}
              disabled={!hasUnappliedRecommendations}
              className="h-8 rounded-full border-border/55 bg-white/80 px-3 text-[11px] shadow-sm"
            >
              Apply
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            {hasUnappliedRecommendations
              ? 'Apply recommended tests to update the Validation Suite selection.'
              : 'Recommended tests are already selected in the Validation Suite.'}
          </p>
        </section>
      ) : null}

      {(coachPayload.insightHighlights || []).length > 0 ? (
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Key insights
          </p>
          <div className="space-y-1.5">
            {coachPayload.insightHighlights?.slice(0, 3).map((insight) => (
              <div
                key={insight}
                className="flex gap-2 rounded-[16px] border border-border/40 bg-white/52 px-3 py-2.5"
              >
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/55" />
                <p className="text-[12px] leading-5 text-muted-foreground">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(coachPayload.checklistItems || []).length > 0 ? (
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Working checklist
          </p>
          <div className="space-y-1.5">
            {coachPayload.checklistItems?.map((item) => {
              const isChecked = checkedChecklistItems.includes(item);

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onToggleChecklistItem(item)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[16px] border px-3 py-2.5 text-left transition-colors',
                    isChecked
                      ? 'border-border/35 bg-white/45 text-muted-foreground'
                      : 'border-border/45 bg-white/62 text-foreground/90 hover:bg-white/74'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                      isChecked
                        ? 'border-primary/45 bg-primary text-primary-foreground'
                        : 'border-border/60 bg-white/85 text-transparent'
                    )}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span
                    className={cn(
                      'text-[12px] leading-5',
                      isChecked && 'line-through opacity-70'
                    )}
                  >
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function getModeLabel(mode: ChatAgentMode) {
  switch (mode) {
    case 'analysis':
      return 'Interpreting results';
    case 'action':
      return 'Driving next steps';
    case 'coaching':
      return 'Coaching mode';
    case 'intake':
    default:
      return 'Building context';
  }
}

function getValidationTestLabel(testId: ValidationTestId) {
  return VALIDATION_TEST_CATALOG.find((test) => test.id === testId)?.label || testId;
}

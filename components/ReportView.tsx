import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PersonaCard } from '@/components/PersonaCard';
import { MetricsTable } from '@/components/MetricsTable';
import type { UXReport } from '@/lib/types';
import { cn } from '@/lib/utils';

function SeverityBadge({
  severity,
}: {
  severity: 'Good' | 'Needs Work' | 'Critical';
}) {
  const config = {
    Good: { icon: '✅', label: 'Good', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    'Needs Work': { icon: '⚠️', label: 'Needs Work', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    Critical: { icon: '🔴', label: 'Critical', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  };
  const { icon, label, className } = config[severity];
  return (
    <Badge variant="secondary" className={cn('border-0 font-medium', className)}>
      {icon} {label}
    </Badge>
  );
}

function FindingCard({
  category,
  findings,
  severity,
}: {
  category: string;
  findings: string[];
  severity: 'Good' | 'Needs Work' | 'Critical';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{category}</h3>
          <SeverityBadge severity={severity} />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ReportView({ report }: { report: UXReport }) {
  const { persona, findings, metrics, recommendations, personaVerdict } = report;
  const top3 = recommendations
    .filter((r) => r.rank <= 3)
    .sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-8">
      <PersonaCard persona={persona} />

      <section>
        <h2 className="mb-4 text-lg font-semibold">UX Findings</h2>
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {findings.map((f, i) => (
            <FindingCard
              key={i}
              category={f.category}
              findings={f.findings}
              severity={f.severity}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Metric Predictions</h2>
        <Card>
          <CardContent className="pt-6">
            <MetricsTable metrics={metrics} />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Top 3 Recommendations</h2>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
          {top3.map((rec) => (
            <Card key={rec.rank} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {rec.rank}
                </div>
                <h3 className="pt-2 font-semibold">{rec.whatToChange}</h3>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Why:</span>{' '}
                  {rec.whyItMatters}
                </p>
                <p>
                  <span className="font-medium text-foreground">Impact:</span>{' '}
                  {rec.expectedImpact}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Persona Verdict</h2>
        <blockquote className="border-l-4 border-primary/50 bg-muted/50 py-4 pl-6 pr-4 text-lg italic">
          &ldquo;{personaVerdict}&rdquo;
        </blockquote>
      </section>
    </div>
  );
}

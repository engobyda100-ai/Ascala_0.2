import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Persona } from '@/lib/types';
import { cn } from '@/lib/utils';

function TechSavvinessDots({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Tech savviness: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i <= value ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </span>
  );
}

export function PersonaCard({ persona }: { persona: Persona }) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="px-4 pb-2 pt-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold">{persona.name}</h2>
          <span className="text-sm text-muted-foreground">
            {persona.age} · {persona.jobTitle} · {persona.companySize}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Tech savviness</span>
          <TechSavvinessDots value={persona.techSavviness} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
          &ldquo;{persona.quote}&rdquo;
        </blockquote>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Goals</h3>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
              {persona.goals.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Frustrations</h3>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
              {persona.frustrations.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Signup Triggers</h3>
            <p className="text-sm text-muted-foreground">
              {persona.signupTriggers.join(' · ')}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Bounce Triggers</h3>
            <p className="text-sm text-muted-foreground">
              {persona.bounceTriggers.join(' · ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

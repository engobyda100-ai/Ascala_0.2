'use client';

import { useState } from 'react';
import { ReviewForm } from '@/components/ReviewForm';
import { ReportView } from '@/components/ReportView';
import type { UXReport } from '@/lib/types';

export default function Home() {
  const [report, setReport] = useState<UXReport | null>(null);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">
            Persona UX Reviewer
          </h1>
          <p className="mt-2 text-muted-foreground">
            Target market + app URL → persona-driven UX report
          </p>
        </header>

        {report ? (
          <ReportView report={report} />
        ) : (
          <ReviewForm onReport={setReport} />
        )}

        {report && (
          <div className="mt-12">
            <button
              onClick={() => setReport(null)}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              ← Start a new review
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

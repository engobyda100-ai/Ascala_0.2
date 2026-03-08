'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UXReport } from '@/lib/types';

const STAGES = [
  'Generating persona 🧑‍🤝‍🧑 💭 (OB coded this app)...',
  'Browsing app 🌐 💻...',
  'Analyzing 🔍 👀...',
] as const;

export function ReviewForm({
  onReport,
}: {
  onReport: (report: UXReport) => void;
}) {
  const [targetMarket, setTargetMarket] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStageIndex(0);

    const interval = setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, 8000);

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMarket, appUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Review failed');
      }

      onReport(data as UXReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Start a UX Review</CardTitle>
        <CardDescription>
          Enter your target market and app URL. We&apos;ll generate a persona and
          analyze your app through their eyes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="targetMarket"
              className="text-sm font-medium leading-none"
            >
              Target Market Description
            </label>
            <Textarea
              id="targetMarket"
              placeholder="e.g. SaaS founders at Series A startups (10-50 employees) looking for analytics tools. They're busy, price-sensitive, and need quick time-to-value. They hate long onboarding and opaque pricing."
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              className="min-h-[120px] resize-y"
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="appUrl" className="text-sm font-medium leading-none">
              App URL
            </label>
            <Input
              id="appUrl"
              type="url"
              placeholder="https://your-app.com"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGES[stageIndex]}
              </span>
            ) : (
              'Let Ascala take a look'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

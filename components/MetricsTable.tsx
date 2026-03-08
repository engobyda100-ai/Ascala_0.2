import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MetricPrediction } from '@/lib/types';
import { cn } from '@/lib/utils';

function RatingBadge({ rating }: { rating: 'High' | 'Medium' | 'Low' }) {
  const styles = {
    High: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    Medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    Low: 'bg-red-500/15 text-red-700 dark:text-red-400',
  };
  return (
    <Badge
      variant="secondary"
      className={cn('border-0 font-medium', styles[rating])}
    >
      {rating}
    </Badge>
  );
}

export function MetricsTable({ metrics }: { metrics: MetricPrediction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead className="w-[120px]">Rating</TableHead>
          <TableHead>Rationale</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((m, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{m.metric}</TableCell>
            <TableCell>
              <RatingBadge rating={m.rating} />
            </TableCell>
            <TableCell className="text-muted-foreground">{m.rationale}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

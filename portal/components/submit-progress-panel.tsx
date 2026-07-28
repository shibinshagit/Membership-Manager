'use client';

import { Progress } from '@/components/ui/progress';

type SubmitProgressPanelProps = {
  open: boolean;
  percent: number;
  label: string;
};

export function SubmitProgressPanel({ open, percent, label }: SubmitProgressPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-lg">
        <div className="space-y-1">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">Please wait — do not close this page.</p>
        </div>
        <Progress value={percent} className="h-2.5" />
        <p className="text-right text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</p>
      </div>
    </div>
  );
}

import { HeartHandshake } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/data-list';
import { AppIcon } from '@/components/icons/app-icon';

export function WelfareBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="info" icon={HeartHandshake} className={className}>
      Welfare
    </StatusBadge>
  );
}

export function WelfareEligibleBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning-foreground ring-1 ring-inset ring-warning/25 ${className || ''}`}
    >
      <AppIcon icon={HeartHandshake} className="h-3.5 w-3.5 shrink-0" />
      Welfare pending
    </span>
  );
}

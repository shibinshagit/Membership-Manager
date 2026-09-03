import { UsersRound } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/data-list';

export function WhatsAppGroupBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="success" icon={UsersRound} className={className}>
      In WA group
    </StatusBadge>
  );
}

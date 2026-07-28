import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconTile } from '@/components/icons/icon-tile';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-card p-3 shadow-sm sm:p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon: LucideIcon;
  href?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const content = (
    <div className="h-full rounded-lg border border-border/80 bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <IconTile icon={Icon} />
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    );
  }

  return content;
}

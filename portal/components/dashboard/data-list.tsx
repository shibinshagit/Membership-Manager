import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/icons/app-icon';
import { IconTile } from '@/components/icons/icon-tile';

export function DataList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Keeps desktop columns from crushing; scrolls horizontally when needed. */
export function DataListScroll({
  children,
  minWidth = '56rem',
  className,
}: {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

export function DataListLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function DataListEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <IconTile icon={icon} size="xl" className="mb-4" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function DataListHead({
  columns,
  className,
}: {
  columns: Array<{ key: string; label: React.ReactNode; className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid items-center gap-3 border-b border-border/80 bg-muted/40 px-4 py-2.5',
        '[&>*]:min-w-0',
        className
      )}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
            column.className
          )}
        >
          {column.label}
        </div>
      ))}
    </div>
  );
}

export function DataListRow({
  children,
  className,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'grid w-full items-center gap-3 border-b border-border/60 px-4 py-3.5 text-left last:border-b-0 transition-colors',
        '[&>*]:min-w-0 [&>*]:overflow-hidden',
        'hover:bg-muted/35 data-[selected=true]:bg-primary/[0.06]',
        onClick &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Mobile-friendly stacked card row (use below md; pair with desktop DataListScroll). */
export function DataListCard({
  children,
  className,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'space-y-3 border-b border-border/60 px-4 py-4 last:border-b-0 transition-colors',
        'hover:bg-muted/35 data-[selected=true]:bg-primary/[0.06]',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function EntityAvatar({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const isCompact = Boolean(className?.includes('h-8') || className?.includes('h-9'));
  return (
    <IconTile
      icon={UserRound}
      size={isCompact ? 'sm' : 'md'}
      className={cn('rounded-full', className)}
      iconClassName={isCompact ? 'h-4 w-4' : 'h-5 w-5'}
      aria-hidden={!name}
      aria-label={name ? `Avatar for ${name}` : undefined}
    />
  );
}

export function EntityMeta({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  const titleNode = href ? (
    <Link
      href={href}
      className="block truncate font-medium text-foreground hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {title}
    </Link>
  ) : (
    <p className="block truncate font-medium text-foreground">{title}</p>
  );

  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      {titleNode}
      {subtitle ? (
        <p className="block truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      ) : null}
    </div>
  );
}

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/20 text-warning-foreground ring-warning/30',
  danger: 'bg-destructive/10 text-destructive ring-destructive/20',
  info: 'bg-primary/10 text-primary ring-primary/20',
  neutral: 'bg-muted text-muted-foreground ring-border',
};

export function StatusBadge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs font-medium capitalize ring-1 ring-inset',
        toneClasses[tone],
        className
      )}
    >
      {icon ? <AppIcon icon={icon} className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function paymentStatusTone(status: string): StatusTone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'pending':
    case 'unpaid':
    case 'partial':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function memberStatusTone(status: string): StatusTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending':
      return 'info';
    case 'suspended':
      return 'warning';
    case 'expired':
      return 'danger';
    case 'inactive':
    default:
      return 'neutral';
  }
}

export const FEE_LIST_COLS =
  'grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1.1fr)_6.5rem_7.5rem_7rem_9rem]';

export const DOC_LIST_COLS =
  'grid-cols-[minmax(12rem,1.3fr)_minmax(10rem,1.2fr)_5rem_7.5rem_7rem]';

export const MEMBER_LIST_COLS =
  'grid-cols-[2.25rem_7rem_minmax(12rem,1.4fr)_8rem_6.5rem_6rem_5.5rem_4.5rem]';

export const EXEC_LIST_COLS =
  'grid-cols-[minmax(12rem,1.5fr)_7.5rem_8rem_6.5rem_5rem]';

export const COMMITTEE_LIST_COLS =
  'grid-cols-[minmax(12rem,1.3fr)_6.5rem_5rem_minmax(8rem,1fr)_9rem]';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/icons/app-icon';

const sizeClasses = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
  xl: 'h-14 w-14 rounded-2xl',
} as const;

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
} as const;

/** Page icon chip: black tile + brand green glyph (not used in sidebar). */
export function IconTile({
  icon,
  size = 'md',
  className,
  iconClassName,
  ...props
}: {
  icon: LucideIcon;
  size?: keyof typeof sizeClasses;
  className?: string;
  iconClassName?: string;
} & React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-icon-tile text-icon-tile-foreground',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <AppIcon icon={icon} className={cn(iconSizeClasses[size], iconClassName)} />
    </div>
  );
}

export function IconTileBox({
  children,
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-icon-tile text-icon-tile-foreground',
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}

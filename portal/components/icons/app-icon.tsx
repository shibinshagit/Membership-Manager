import type { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppIconProps = LucideProps & {
  icon: LucideIcon;
};

/** Consistent stroke and sizing for Lucide icons across the app. */
export function AppIcon({
  icon: Icon,
  className,
  strokeWidth = 1.75,
  absoluteStrokeWidth = true,
  ...props
}: AppIconProps) {
  return (
    <Icon
      className={cn('shrink-0', className)}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      {...props}
    />
  );
}

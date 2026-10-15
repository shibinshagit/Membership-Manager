'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/dashboard';

  return (
    <main
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pt-14 lg:pt-0',
        isLanding ? 'bg-[#0f2f2c]' : 'bg-muted/30'
      )}
    >
      <div
        className={cn(
          isLanding ? 'w-full' : 'mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8'
        )}
      >
        {children}
      </div>
    </main>
  );
}

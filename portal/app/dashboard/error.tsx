'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard page error:', error);
  }, [error]);

  const isChunkError =
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
      error?.message || ''
    );

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">This page couldn’t load</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {isChunkError
            ? 'The app was updated. Please do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to load the latest version.'
            : 'Something went wrong while opening this page. Try again, or go back to the dashboard.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => {
            if (isChunkError) {
              window.location.reload();
              return;
            }
            reset();
          }}
        >
          Reload
        </Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    </div>
  );
}

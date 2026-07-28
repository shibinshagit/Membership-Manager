'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Manual fee creation removed — yearly fees are automatic; use member Lifetime upgrade for AED 750. */
export default function NewFeeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/fees');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      Redirecting to fees…
    </div>
  );
}

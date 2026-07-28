'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { PoweredByOpenCoders } from '@/components/powered-by-opencoders';

function SuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') || '';
  const name = searchParams.get('name') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Application Submitted</h1>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Thank you{name ? `, ${name}` : ''}!</CardTitle>
            <CardDescription>
              Your membership application has been received and is pending review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {ref && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Your reference number</p>
                <p className="font-mono text-lg font-semibold mt-1">{ref}</p>
              </div>
            )}
            <div className="text-sm text-muted-foreground space-y-2 text-left">
              <p>The committee will review your application shortly.</p>
              <p>Once approved, you will become an active member. No further action is needed from you at this time.</p>
              <p>If you have questions, contact your association administrator with your reference number.</p>
            </div>
          </CardContent>
        </Card>

        <PoweredByOpenCoders className="mt-6 text-center text-xs text-muted-foreground" />
      </div>
    </div>
  );
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

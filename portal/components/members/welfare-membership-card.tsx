'use client';

import { useState } from 'react';
import { Loader2, HeartHandshake, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WelfareBadge } from '@/components/members/welfare-badge';
import { cn } from '@/lib/utils';
import { formatFeeTypeLabel } from '@/lib/fees-calendar';
import {
  type WelfareSummary,
  WELFARE_INSTALLMENT_AMOUNT,
  WELFARE_INSTALLMENT_COUNT,
  WELFARE_INSTALLMENT_TOTAL,
  WELFARE_LUMP_AMOUNT,
  WELFARE_REQUIRED_YEARS,
} from '@/lib/welfare-policy';

type WelfarePaymentAction = 'installment' | 'lump' | 'settlement';

type WelfareFee = {
  id: number;
  fee_type: string;
  fee_year?: string;
  amount: number;
  currency: string;
  payment_status: string;
  paid_date?: string | null;
};

export function WelfareMembershipCard({
  memberId,
  welfare,
  welfareFees,
  onUpdated,
  onToggleFeePaid,
  onDeleteFee,
  feeActionLoading,
}: {
  memberId: number;
  welfare: WelfareSummary;
  welfareFees: WelfareFee[];
  onUpdated: () => Promise<void> | void;
  onToggleFeePaid: (fee: WelfareFee) => Promise<void>;
  onDeleteFee: (fee: WelfareFee) => Promise<void>;
  feeActionLoading: number | null;
}) {
  const [loading, setLoading] = useState<WelfarePaymentAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const recordPayment = async (paymentType: WelfarePaymentAction) => {
    setLoading(paymentType);
    setMessage(null);
    try {
      const res = await fetch(`/api/members/${memberId}/welfare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', payment_type: paymentType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to create welfare invoice.');
        return;
      }
      setMessage(data.message || 'Welfare invoice created. Mark it paid below once received.');
      await onUpdated();
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const eligibilityLabel = welfare.eligible
    ? 'Eligible for welfare membership'
    : welfare.eligibility_date
      ? `Eligible from ${new Date(welfare.eligibility_date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })} (${welfare.years_until_eligible} year${welfare.years_until_eligible === 1 ? '' : 's'} left)`
      : 'Join date required for eligibility';

  const planLabel =
    welfare.payment_mode === 'lump'
      ? `One time (AED ${WELFARE_LUMP_AMOUNT.toLocaleString()})`
      : welfare.payment_mode === 'installment'
        ? `Installments (AED ${WELFARE_INSTALLMENT_TOTAL.toLocaleString()} total)`
        : `Choose one time (AED ${WELFARE_LUMP_AMOUNT.toLocaleString()}) or installments (AED ${WELFARE_INSTALLMENT_TOTAL.toLocaleString()})`;

  const showActions =
    !welfare.is_welfare_member &&
    !welfare.payment_complete &&
    (welfare.can_pay_lump || welfare.can_add_installment || welfare.can_settle_remaining);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-primary" />
            Welfare Membership
            {welfare.is_welfare_member ? <WelfareBadge /> : null}
          </CardTitle>
          <CardDescription>
            After {WELFARE_REQUIRED_YEARS} years of membership, members can join welfare by paying AED{' '}
            {WELFARE_INSTALLMENT_AMOUNT}/year for {WELFARE_INSTALLMENT_COUNT} years (AED{' '}
            {WELFARE_INSTALLMENT_TOTAL}) or AED {WELFARE_LUMP_AMOUNT} one time. Payments can start
            before eligibility; welfare status activates once both conditions are met.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Plan: </span>
          <span className="font-medium">{planLabel}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Membership years</p>
            <p className="text-lg font-semibold">{welfare.years_completed}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Eligibility</p>
            <p className="text-sm font-medium">{eligibilityLabel}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Welfare paid</p>
            <p className="text-lg font-semibold tabular-nums">
              AED {welfare.paid_amount.toLocaleString()}
              {welfare.payment_mode ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {welfare.target_amount.toLocaleString()}
                </span>
              ) : null}
            </p>
            {welfare.unpaid_invoiced_amount > 0 ? (
              <p className="mt-1 text-xs text-warning-foreground">
                AED {welfare.unpaid_invoiced_amount.toLocaleString()} invoiced, not yet paid
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p
              className={cn(
                'text-lg font-semibold tabular-nums',
                welfare.remaining_amount > 0 ? 'text-destructive' : 'text-success'
              )}
            >
              AED {welfare.remaining_amount.toLocaleString()}
            </p>
          </div>
        </div>

        {welfare.payment_mode === 'installment' ? (
          <p className="text-sm text-muted-foreground">
            Installments: {welfare.installments_paid} of {WELFARE_INSTALLMENT_COUNT} paid
            {welfare.installments_invoiced > welfare.installments_paid
              ? ` · ${welfare.installments_invoiced - welfare.installments_paid} pending payment`
              : ''}
            {welfare.installments_remaining > 0 && !welfare.payment_complete
              ? ` · up to ${welfare.installments_remaining} more can be invoiced`
              : ''}
          </p>
        ) : null}

        {welfare.has_unpaid_invoice ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
            You have an unpaid welfare invoice below. Mark it paid to update the total, or delete it
            to undo and choose a different payment option.
          </p>
        ) : null}

        {welfare.payment_complete && !welfare.is_welfare_member && welfare.waiting_for_eligibility ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
            Full welfare payment received. Welfare badge will activate automatically on{' '}
            {welfare.eligibility_date
              ? new Date(welfare.eligibility_date).toLocaleDateString('en-GB')
              : 'eligibility date'}
            .
          </p>
        ) : null}

        {welfare.payment_complete && welfare.is_welfare_member ? (
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Welfare payment complete. This member is a welfare member.
          </p>
        ) : null}

        {showActions ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {welfare.can_pay_lump ? (
              <Button disabled={loading !== null} onClick={() => recordPayment('lump')}>
                {loading === 'lump' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                One time AED {WELFARE_LUMP_AMOUNT}
              </Button>
            ) : null}
            {welfare.can_add_installment ? (
              <Button
                variant="outline"
                disabled={loading !== null}
                onClick={() => recordPayment('installment')}
              >
                {loading === 'installment' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Installment {welfare.installments_invoiced + 1} of {WELFARE_INSTALLMENT_COUNT} (AED{' '}
                {WELFARE_INSTALLMENT_AMOUNT})
              </Button>
            ) : null}
            {welfare.can_settle_remaining ? (
              <Button
                variant="secondary"
                disabled={loading !== null}
                onClick={() => recordPayment('settlement')}
              >
                {loading === 'settlement' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Settle remaining AED {welfare.remaining_amount.toLocaleString()}
              </Button>
            ) : null}
          </div>
        ) : null}

        {welfareFees.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Welfare invoices</p>
            <div className="space-y-2">
              {welfareFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {formatFeeTypeLabel({
                        feeType: fee.fee_type,
                        feeYear: fee.fee_year,
                        amount: fee.amount,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {fee.currency} {Number(fee.amount).toLocaleString()} · {fee.payment_status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={feeActionLoading === fee.id}
                      onClick={() => onToggleFeePaid(fee)}
                    >
                      {fee.payment_status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                    </Button>
                    {fee.payment_status !== 'paid' ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={feeActionLoading === fee.id}
                        onClick={() => onDeleteFee(fee)}
                        title="Delete invoice (undo)"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {welfare.is_welfare_member && welfare.welfare_joined_date ? (
          <p className="text-sm text-muted-foreground">
            Welfare member since{' '}
            {new Date(welfare.welfare_joined_date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            .
          </p>
        ) : null}

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

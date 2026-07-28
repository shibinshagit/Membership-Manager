'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CircleDollarSign,
  Search,
  CircleCheck,
  Clock3,
  CircleAlert,
  Loader2,
  Trash2,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader, FilterBar, StatCard } from '@/components/dashboard/page-header';
import {
  DataList,
  DataListCard,
  DataListEmpty,
  DataListHead,
  DataListLoading,
  DataListRow,
  DataListScroll,
  EntityAvatar,
  EntityMeta,
  StatusBadge,
  paymentStatusTone,
  FEE_LIST_COLS,
} from '@/components/dashboard/data-list';
import { AppIcon } from '@/components/icons/app-icon';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

interface Fee {
  id: number;
  member_id: number;
  fee_type: string;
  fee_year?: string;
  amount: number;
  currency: string;
  due_date: string;
  paid_date: string | null;
  payment_status: string;
  payment_method: string | null;
  member_name: string;
  member_code: string;
  member_phone: string;
  member_whatsapp: string | null;
}

interface Stats {
  pending_total: number;
  overdue_total: number;
  paid_total: number;
  pending_count: number;
  overdue_count: number;
  paid_count: number;
}

const FEE_OPTIONS = [
  { value: 'annual_membership', label: 'Annual Membership (calendar year)', amount: '50' },
  { value: 'lifetime_membership', label: 'Lifetime Membership', amount: '750' },
];

export default function FeesPage() {
  const searchParams = useSearchParams();
  const [fees, setFees] = useState<Fee[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentDetails, setPaymentDetails] = useState({
    payment_method: '',
    transaction_reference: '',
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchFees = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);

    try {
      const res = await fetch(`/api/fees?${params}`);
      const data = await res.json();
      setFees(data.fees || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching fees:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const filteredFees = fees.filter((fee) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      fee.member_name.toLowerCase().includes(q) ||
      fee.member_code.toLowerCase().includes(q) ||
      fee.fee_type.replace(/_/g, ' ').toLowerCase().includes(q)
    );
  });

  const handleDeleteFee = async (fee: Fee) => {
    if (!confirm(`Delete fee for ${fee.member_name} (${getFeeTypeLabel(fee.fee_type, fee.fee_year)})?`)) {
      return;
    }
    setDeletingId(fee.id);
    try {
      const res = await fetch(`/api/fees/${fee.id}`, { method: 'DELETE' });
      if (res.ok) fetchFees();
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedFee) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/fees/${selectedFee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          payment_method: paymentDetails.payment_method || null,
          transaction_reference: paymentDetails.transaction_reference || null,
        }),
      });

      if (res.ok) {
        setMarkPaidDialogOpen(false);
        setSelectedFee(null);
        setPaymentDetails({ payment_method: '', transaction_reference: '' });
        fetchFees();
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return CircleCheck;
      case 'pending':
      case 'unpaid':
      case 'partial':
        return Clock3;
      case 'overdue':
        return CircleAlert;
      default:
        return undefined;
    }
  };

  const getFeeTypeLabel = (feeType: string, feeYear?: string) => {
    if (feeType === 'lifetime_membership' || feeYear === 'lifetime') return 'Lifetime Membership';
    if (feeYear) return `Annual Membership ${feeYear}`;
    const match = FEE_OPTIONS.find((option) => option.value === feeType);
    return match ? match.label : feeType.replace(/_/g, ' ');
  };

  const generateWhatsAppLink = (fee: Fee) => {
    const phone = (fee.member_whatsapp || fee.member_phone).replace(/\D/g, '');
    const yearLabel = fee.fee_year === 'lifetime' ? 'lifetime' : fee.fee_year || '';
    const message = encodeURIComponent(
      `Hello ${fee.member_name},\n\nThis is a reminder about your ${getFeeTypeLabel(fee.fee_type, fee.fee_year)} payment of ${fee.currency} ${fee.amount.toLocaleString()}${yearLabel ? ` (${yearLabel})` : ''}.\n\nDue Date: ${format(new Date(fee.due_date), 'PP')}\n\nPlease make the payment at your earliest convenience.\n\nThank you!`
    );
    return `https://wa.me/${phone}?text=${message}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees & Payments"
        description="Yearly dues are created automatically per member. Download PDF invoices, mark paid, or send WhatsApp reminders."
      />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <button type="button" className="text-left" onClick={() => setFilterStatus('unpaid')}>
            <StatCard
              title="Pending"
              value={`AED ${Number(stats.pending_total).toLocaleString()}`}
              description={`${stats.pending_count} payments`}
              icon={Clock3}
              tone="warning"
            />
          </button>
          <button type="button" className="text-left" onClick={() => setFilterStatus('overdue')}>
            <StatCard
              title="Overdue"
              value={`AED ${Number(stats.overdue_total).toLocaleString()}`}
              description={`${stats.overdue_count} payments`}
              icon={CircleAlert}
              tone="danger"
            />
          </button>
          <button type="button" className="text-left" onClick={() => setFilterStatus('paid')}>
            <StatCard
              title="Paid"
              value={`AED ${Number(stats.paid_total).toLocaleString()}`}
              description={`${stats.paid_count} payments`}
              icon={CircleCheck}
              tone="success"
            />
          </button>
        </div>
      )}

      <FilterBar>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by member name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            {(filterStatus !== 'all' || searchTerm) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
      </FilterBar>

      <DataList>
        {loading ? (
          <DataListLoading />
        ) : filteredFees.length === 0 ? (
          <DataListEmpty
            icon={CircleDollarSign}
            title="No fees found"
            description={
              filterStatus !== 'all' || searchTerm
                ? 'Try adjusting your search or filters'
                : 'Fees appear automatically from member yearly dues and lifetime upgrades'
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden">
              {filteredFees.map((fee) => (
                <DataListCard key={fee.id}>
                  <div className="flex min-w-0 items-start gap-3">
                    <EntityAvatar name={fee.member_name} />
                    <div className="min-w-0 flex-1">
                      <EntityMeta
                        title={fee.member_name}
                        subtitle={fee.member_code}
                        href={`/dashboard/members/${fee.member_id}`}
                      />
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {getFeeTypeLabel(fee.fee_type, fee.fee_year)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={paymentStatusTone(fee.payment_status)}
                      icon={getStatusIcon(fee.payment_status)}
                    >
                      {fee.payment_status}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold tabular-nums">
                        {fee.currency} {Number(fee.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(fee.due_date), 'PP')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {fee.payment_status !== 'paid' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedFee(fee);
                              setMarkPaidDialogOpen(true);
                            }}
                          >
                            <AppIcon icon={CircleCheck} className="h-3.5 w-3.5" />
                            Mark Paid
                          </Button>
                          <Button variant="outline" size="icon-sm" asChild>
                            <a
                              href={generateWhatsAppLink(fee)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Send WhatsApp reminder"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                            </a>
                          </Button>
                        </>
                      ) : null}
                        <Button variant="outline" size="icon-sm" asChild>
                          <a
                            href={`/api/fees/${fee.id}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF invoice"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === fee.id}
                        onClick={() => handleDeleteFee(fee)}
                        title="Delete fee"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </DataListCard>
              ))}
            </div>

            {/* Desktop / tablet table */}
            <DataListScroll className="hidden md:block" minWidth="52rem">
              <DataListHead
                className={FEE_LIST_COLS}
                columns={[
                  { key: 'member', label: 'Member' },
                  { key: 'type', label: 'Fee Type' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'due', label: 'Due Date' },
                  { key: 'status', label: 'Status' },
                  { key: 'actions', label: 'Actions', className: 'text-right' },
                ]}
              />
              {filteredFees.map((fee) => (
                <DataListRow key={fee.id} className={FEE_LIST_COLS}>
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <EntityAvatar name={fee.member_name} />
                    <EntityMeta
                      title={fee.member_name}
                      subtitle={fee.member_code}
                      href={`/dashboard/members/${fee.member_id}`}
                    />
                  </div>
                  <p className="truncate text-sm text-foreground">
                    {getFeeTypeLabel(fee.fee_type, fee.fee_year)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {fee.currency} {Number(fee.amount).toLocaleString()}
                  </p>
                  <div className="overflow-hidden">
                    <p className="truncate text-sm text-foreground">
                      {format(new Date(fee.due_date), 'PP')}
                    </p>
                    {fee.paid_date ? (
                      <p className="truncate text-xs text-success">
                        Paid {format(new Date(fee.paid_date), 'PP')}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <StatusBadge
                      tone={paymentStatusTone(fee.payment_status)}
                      icon={getStatusIcon(fee.payment_status)}
                    >
                      {fee.payment_status}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-end gap-1 !overflow-visible">
                    {fee.payment_status !== 'paid' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setSelectedFee(fee);
                            setMarkPaidDialogOpen(true);
                          }}
                        >
                          <AppIcon icon={CircleCheck} className="h-3.5 w-3.5" />
                          Mark Paid
                        </Button>
                        <Button variant="outline" size="icon-sm" className="shrink-0" asChild>
                          <a
                            href={generateWhatsAppLink(fee)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Send WhatsApp reminder"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                          </a>
                        </Button>
                      </>
                    ) : null}
                    <Button variant="outline" size="icon-sm" className="shrink-0" asChild>
                      <a
                        href={`/api/fees/${fee.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download PDF invoice"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      disabled={deletingId === fee.id}
                      onClick={() => handleDeleteFee(fee)}
                      title="Delete fee"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </DataListRow>
              ))}
            </DataListScroll>
          </>
        )}
      </DataList>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record payment details for {selectedFee?.member_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="font-medium">{selectedFee ? getFeeTypeLabel(selectedFee.fee_type) : ''}</p>
              <p className="text-lg font-bold">
                {selectedFee?.currency} {selectedFee?.amount.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentDetails.payment_method}
                onValueChange={(v) => setPaymentDetails({ ...paymentDetails, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference (Optional)</Label>
              <Input
                placeholder="Receipt or transaction number"
                value={paymentDetails.transaction_reference}
                onChange={(e) =>
                  setPaymentDetails({ ...paymentDetails, transaction_reference: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkPaidDialogOpen(false);
                setSelectedFee(null);
                setPaymentDetails({ payment_method: '', transaction_reference: '' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

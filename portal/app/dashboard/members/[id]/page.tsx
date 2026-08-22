'use client';

import { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  User,
  FileText,
  DollarSign,
  Trash2,
  Edit,
  Save,
  X,
  Upload,
  MessageSquare,
  Eye,
  Download,
  IdCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WARD_SELECT_OPTIONS, formatWardNoLabel } from '@/lib/members/ward-numbers';
import { MemberIdentityCard } from '@/components/members/member-identity-card';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import {
  downloadIdentityCardPng,
  getIdentityCardPhotoUrl,
  shareIdentityCardToWhatsApp,
  type MemberIdentityCardData,
} from '@/lib/members/identity-card';
import { MembershipYearsPicker } from '@/components/members/membership-years-picker';
import { WelfareMembershipCard } from '@/components/members/welfare-membership-card';
import { WelfareBadge } from '@/components/members/welfare-badge';
import type { WelfareSummary } from '@/lib/welfare-policy';
import { isWelfareFeeRow } from '@/lib/welfare-policy';
import {
  currentCalendarYear,
  formatFeeTypeLabel,
  normalizeFeeYearLabel,
  normalizeJoinYear,
} from '@/lib/fees-calendar';

interface Member {
  id: number;
  member_id: string;
  full_name: string;
  gender: string | null;
  blood_group: string | null;
  marital_status: string | null;
  email: string | null;
  phone: string;
  whatsapp_number: string | null;
  date_of_birth: string | null;
  nominee: string | null;
  ward_no: number | null;
  emirates_id: string | null;
  passport_number: string | null;
  visa_status: string | null;
  profession: string | null;
  company_name: string | null;
  work_location: string | null;
  address: string | null;
  uae_building: string | null;
  uae_area: string | null;
  uae_city: string | null;
  home_country_address: string | null;
  home_state: string | null;
  home_district: string | null;
  home_local_body: string | null;
  home_local_area_ward: string | null;
  home_country_contact_number: string | null;
  spouse_name: string | null;
  children_count: number | null;
  children_details: string | null;
  family_residing_with: boolean | null;
  membership_type: string;
  membership_plan?: 'annual' | 'lifetime' | null;
  membership_payment_status?: 'paid' | 'unpaid' | null;
  membership_fee_year?: string | null;
  join_year?: number | null;
  paid_years?: number[] | null;
  lifetime_started_on?: string | null;
  membership_start_date: string;
  membership_end_date: string | null;
  status: string;
  is_welfare_member?: boolean | null;
  assigned_executive_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: number;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  created_at: string;
}

interface Fee {
  id: number;
  fee_type: string;
  fee_year?: string;
  amount: number;
  currency: string;
  due_date: string;
  paid_date: string | null;
  payment_status: string;
  payment_method: string | null;
}

type FeeRecordFilter = 'all' | 'unpaid' | 'paid';

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Partial<Member>>({});
  const [joinYear, setJoinYear] = useState(currentCalendarYear());
  const [paidYears, setPaidYears] = useState<number[]>([]);
  const [lifetimeStartDate, setLifetimeStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [feeRecordFilter, setFeeRecordFilter] = useState<FeeRecordFilter>('all');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadType, setDocUploadType] = useState('emirates_id');
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [identityPhotoUrl, setIdentityPhotoUrl] = useState<string | null>(null);
  const [feeActionLoading, setFeeActionLoading] = useState<number | null>(null);
  const [lifetimeLoading, setLifetimeLoading] = useState(false);
  const [lifetimeDialogOpen, setLifetimeDialogOpen] = useState(false);
  const [welfare, setWelfare] = useState<WelfareSummary | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const identityCardRef = useRef<HTMLDivElement>(null);

  const handleDocumentUpload = async () => {
    if (!member || !docUploadFile) return;
    setUploadingDoc(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', docUploadFile);
      fd.append('member_id', String(member.id));
      fd.append('document_type', docUploadType);
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to upload document');
        return;
      }
      setDocUploadFile(null);
      await fetchMember();
    } catch {
      setError('Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const getDocumentByType = (type: string) =>
    documents.find((doc) => doc.document_type === type);

  const fetchMember = useCallback(async () => {
    try {
      const res = await fetch(`/api/members/${resolvedParams.id}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch member');
        return;
      }

      setMember(data.member);
      setDocuments(data.documents || []);
      setFees(data.fees || []);
      setWelfare(data.welfare || null);
      setFormData({ ...data.member });
      const nextJoin = normalizeJoinYear(
        data.join_year ?? data.member?.join_year ?? data.member?.joined_date ?? data.member?.membership_start_date
      );
      setJoinYear(nextJoin);
      setPaidYears(
        Array.isArray(data.paid_years)
          ? data.paid_years
          : Array.isArray(data.member?.paid_years)
            ? data.member.paid_years
            : []
      );
      const lifeStart =
        data.lifetime_started_on ||
        data.member?.lifetime_started_on ||
        (data.member?.membership_plan === 'lifetime'
          ? String(data.member?.membership_start_date || '').slice(0, 10)
          : '') ||
        new Date().toISOString().slice(0, 10);
      setLifetimeStartDate(
        /^\d{4}-\d{2}-\d{2}/.test(String(lifeStart))
          ? String(lifeStart).slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const photoPath = getIdentityCardPhotoUrl(documents);

    if (!photoPath) {
      setIdentityPhotoUrl(null);
      return;
    }

    fetch(photoPath)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) {
          setIdentityPhotoUrl(null);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setIdentityPhotoUrl(objectUrl);
      })
      .catch(() => setIdentityPhotoUrl(null));

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documents]);

  const identityCardData: MemberIdentityCardData | null = member
    ? {
        memberId: member.member_id,
        fullName: member.full_name,
        phone: member.phone,
        permanentAddress: member.home_country_address,
        bloodGroup: member.blood_group,
        wardNo: member.ward_no,
        nominee: member.nominee,
        membershipPlan: member.membership_plan,
        membershipStartDate: member.membership_start_date,
        membershipEndDate: member.membership_end_date,
        status: member.status,
        photoUrl: identityPhotoUrl,
      }
    : null;

  const handleDownloadIdentityCard = async () => {
    if (!identityCardRef.current || !member) return;

    setDownloadingCard(true);
    setError('');

    try {
      await downloadIdentityCardPng(
        identityCardRef.current,
        `${member.member_id}-identity-card.png`
      );
    } catch {
      setError('Failed to download identity card. Please try again.');
    } finally {
      setDownloadingCard(false);
    }
  };

  const handleShareIdentityCardWhatsApp = async () => {
    if (!identityCardRef.current || !member) return;

    const phone = member.whatsapp_number || member.phone;
    if (!phone?.trim()) {
      setError('This member has no WhatsApp or phone number to send to.');
      return;
    }

    setSharingCard(true);
    setError('');

    try {
      await shareIdentityCardToWhatsApp({
        element: identityCardRef.current,
        phone,
        fullName: member.full_name,
        memberId: member.member_id,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to open WhatsApp. Please try downloading the card instead.'
      );
    } finally {
      setSharingCard(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const plan = (formData.membership_plan || member?.membership_plan || 'annual') as
        | 'annual'
        | 'lifetime';
      const res = await fetch(`/api/members/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          join_year: joinYear,
          paid_years: paidYears,
          lifetime_start_date: plan === 'lifetime' ? lifetimeStartDate : undefined,
          membership_start_date:
            plan === 'lifetime' ? lifetimeStartDate : formData.membership_start_date,
          membership_payment_status:
            plan === 'lifetime'
              ? formData.membership_payment_status
              : paidYears.includes(currentCalendarYear())
                ? 'paid'
                : 'unpaid',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.errors ? Object.values(data.errors).join(' ') : data.error || 'Failed to update member');
        setSaving(false);
        return;
      }

      setMember(data.member);
      setEditing(false);
      await fetchMember();
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (nextStatus: string) => {
    if (!member || nextStatus === member.status) return;
    setStatusSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update status');
        return;
      }
      setMember((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      setFormData((prev) => ({ ...prev, status: nextStatus }));
      await fetchMember();
    } catch {
      setError('Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const res = await fetch(`/api/members/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/dashboard/members');
      }
    } catch {
      setError('Failed to delete member');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-600';
      case 'suspended':
        return 'bg-amber-500/10 text-amber-600';
      case 'expired':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600';
      case 'unpaid':
      case 'pending':
      case 'partial':
        return 'bg-amber-500/10 text-amber-600';
      case 'overdue':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPreviewUrl = (doc: Document) =>
    `/api/documents/file?pathname=${encodeURIComponent(doc.file_path)}`;

  const isPdf = (doc: Document) =>
    doc.mime_type === 'application/pdf' || doc.file_name.toLowerCase().endsWith('.pdf');

  const isImage = (doc: Document) =>
    doc.mime_type?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(doc.file_name);

  const getFeeTypeLabel = (feeType: string, feeYear?: string, amount?: number) => {
    return formatFeeTypeLabel({
      feeType,
      feeYear,
      amount,
      joinYear,
    });
  };

  const isUnpaidFee = (status: string) => ['unpaid', 'pending', 'partial', 'overdue'].includes(status);

  const handleToggleFeePaid = async (fee: Fee) => {
    setFeeActionLoading(fee.id);
    try {
      const nextStatus = fee.payment_status === 'paid' ? 'unpaid' : 'paid';
      const res = await fetch(`/api/fees/${fee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: nextStatus,
          paid_date: nextStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.welfare) setWelfare(data.welfare);
        await fetchMember();
      }
    } finally {
      setFeeActionLoading(null);
    }
  };

  const handleDeleteFee = async (fee: Fee) => {
    if (!confirm(`Delete fee record for ${getFeeTypeLabel(fee.fee_type, fee.fee_year, fee.amount)}?`)) return;
    setFeeActionLoading(fee.id);
    try {
      const res = await fetch(`/api/fees/${fee.id}`, { method: 'DELETE' });
      if (res.ok) await fetchMember();
    } finally {
      setFeeActionLoading(null);
    }
  };

  const welfareFees = fees.filter((fee) => isWelfareFeeRow(fee));

  const handleLifetimeAction = async (action: 'upgrade' | 'revoke') => {
    if (!member) return;
    if (action === 'upgrade') {
      setLifetimeStartDate(new Date().toISOString().slice(0, 10));
      setLifetimeDialogOpen(true);
      return;
    }
    const ok = confirm(
      'Remove lifetime access? The member will return to annual calendar-year fees (join 100; to 2019: 25; from 2020: 50).'
    );
    if (!ok) return;

    setLifetimeLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${member.id}/lifetime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update lifetime membership');
        return;
      }
      await fetchMember();
    } catch {
      setError('Failed to update lifetime membership');
    } finally {
      setLifetimeLoading(false);
    }
  };

  const confirmLifetimeUpgrade = async () => {
    if (!member) return;
    setLifetimeLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${member.id}/lifetime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade',
          join_year: joinYear,
          paid_years: paidYears,
          lifetime_start_date: lifetimeStartDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to upgrade to lifetime');
        return;
      }
      setLifetimeDialogOpen(false);
      await fetchMember();
    } catch {
      setError('Failed to upgrade to lifetime');
    } finally {
      setLifetimeLoading(false);
    }
  };

  const generateUnpaidInvoiceWhatsAppLink = (fee: Fee) => {
    const phone = (member?.whatsapp_number || member?.phone || '').replace(/\D/g, '');
    if (!phone) return '#';

    const invoiceNo = `INV-${fee.id}`;
    const dueDate = format(new Date(fee.due_date), 'PP');
    const yearLabel =
      fee.fee_year === 'lifetime' ? 'lifetime' : normalizeFeeYearLabel(fee.fee_year);
    const message = encodeURIComponent(
      `Hello ${member?.full_name},\n\nThis is a payment reminder for your membership fee (${yearLabel}).\n\nInvoice: ${invoiceNo}\nFee Type: ${getFeeTypeLabel(fee.fee_type, fee.fee_year, fee.amount)}\nAmount Due: ${fee.currency} ${fee.amount.toLocaleString()}\nDue Date: ${dueDate}\nStatus: ${fee.payment_status.toUpperCase()}\n\nPlease complete the payment and share the receipt.\n\nThank you.`
    );

    return `https://wa.me/${phone}?text=${message}`;
  };

  const paidFeesCount = fees.filter((fee) => !isWelfareFeeRow(fee) && fee.payment_status === 'paid').length;
  const unpaidFeesCount = fees.filter((fee) => !isWelfareFeeRow(fee) && isUnpaidFee(fee.payment_status)).length;
  const filteredFees = fees.filter((fee) => {
    if (isWelfareFeeRow(fee)) return false;
    if (feeRecordFilter === 'paid') return fee.payment_status === 'paid';
    if (feeRecordFilter === 'unpaid') return isUnpaidFee(fee.payment_status);
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Member not found</h2>
        <p className="text-muted-foreground mt-2">{error || 'The requested member does not exist'}</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/members">Back to Members</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl h-[85vh] max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDoc?.file_name || 'Document Preview'}</DialogTitle>
            <DialogDescription>
              {previewDoc ? `${previewDoc.document_type.replace('_', ' ')} - ${member.full_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-md border overflow-hidden bg-muted/20">
            {previewDoc && isImage(previewDoc) && (
              <img
                src={getPreviewUrl(previewDoc)}
                alt={previewDoc.file_name}
                className="w-full h-full object-contain"
              />
            )}
            {previewDoc && isPdf(previewDoc) && (
              <iframe
                src={getPreviewUrl(previewDoc)}
                title={previewDoc.file_name}
                className="w-full h-full"
              />
            )}
            {previewDoc && !isImage(previewDoc) && !isPdf(previewDoc) && (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Preview not supported for this file type.
                </p>
                <Button asChild>
                  <a
                    href={getPreviewUrl(previewDoc)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open File
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/members">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground break-words">{member.full_name}</h1>
              {member.is_welfare_member || welfare?.is_welfare_member ? <WelfareBadge /> : null}
              <span className={cn('text-xs px-2 py-1 rounded-full capitalize', getStatusColor(member.status))}>
                {member.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 font-mono truncate">{member.member_id}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setFormData(member); }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Member?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {member.full_name} and all associated documents and fees.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="gap-2">
            <User className="w-4 h-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" id="documents-tab-trigger">
            <FileText className="w-4 h-4" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Fees ({fees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {!editing && identityCardData && (
            <Card>
              <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3 min-w-0">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IdCard className="w-5 h-5" />
                      Membership Identity Card
                    </CardTitle>
                    <CardDescription>
                      Preview, download, or send the membership identity card on WhatsApp.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={member.status || 'active'}
                      onValueChange={handleQuickStatusChange}
                      disabled={statusSaving}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-8 w-[140px] capitalize',
                          getStatusColor(member.status)
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    {statusSaving && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-[#25D366] text-white hover:bg-[#1ebe57] focus-visible:ring-[#25D366]/40"
                    onClick={handleShareIdentityCardWhatsApp}
                    disabled={sharingCard || downloadingCard}
                  >
                    {sharingCard ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <WhatsAppIcon className="w-4 h-4 mr-2" />
                    )}
                    Send on WhatsApp
                  </Button>
                  <Button onClick={handleDownloadIdentityCard} disabled={downloadingCard || sharingCard}>
                    {downloadingCard ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Download Card
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-2">
                  <div className="flex justify-center min-w-[428px] py-2">
                    <MemberIdentityCard ref={identityCardRef} data={identityCardData} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Membership ID</Label>
                  {editing ? (
                    <Input
                      value={formData.member_id || ''}
                      onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                      placeholder="Member ID"
                    />
                  ) : (
                    <p className="text-sm font-mono">{member.member_id}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Full Name (As per Passport) *</Label>
                  {editing ? (
                    <Input
                      value={formData.full_name || ''}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.full_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  {editing ? (
                    <Input
                      type="date"
                      value={formData.date_of_birth || ''}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.date_of_birth ? format(new Date(member.date_of_birth), 'PP') : '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Nominee</Label>
                  {editing ? (
                    <Input
                      value={formData.nominee || ''}
                      onChange={(e) => setFormData({ ...formData, nominee: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.nominee || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  {editing ? (
                    <Select
                      value={formData.status || 'active'}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn('text-xs px-2 py-1 rounded-full capitalize inline-block', getStatusColor(member.status))}>
                      {member.status}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  {editing ? (
                    <Select
                      value={formData.gender || ''}
                      onValueChange={(v) => setFormData({ ...formData, gender: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm capitalize">{member.gender || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  {editing ? (
                    <Select
                      value={formData.blood_group || ''}
                      onValueChange={(v) => setFormData({ ...formData, blood_group: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{member.blood_group || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Marital Status</Label>
                  {editing ? (
                    <Select
                      value={formData.marital_status || ''}
                      onValueChange={(v) => setFormData({ ...formData, marital_status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm capitalize">{member.marital_status || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  {editing ? (
                    <Input
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.phone}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  {editing ? (
                    <Input
                      value={formData.whatsapp_number || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{member.whatsapp_number || member.phone}</p>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://wa.me/${(member.whatsapp_number || member.phone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {editing ? (
                    <Input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.email || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  {editing ? (
                    <Input
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.address || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  {editing ? (
                    <Input
                      value={formData.uae_building || ''}
                      onChange={(e) => setFormData({ ...formData, uae_building: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.uae_building || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Area</Label>
                  {editing ? (
                    <Input
                      value={formData.uae_area || ''}
                      onChange={(e) => setFormData({ ...formData, uae_area: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.uae_area || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Emirate / City</Label>
                  {editing ? (
                    <Input
                      value={formData.uae_city || ''}
                      onChange={(e) => setFormData({ ...formData, uae_city: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.uae_city || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identity Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Emirates ID *</Label>
                  {editing ? (
                    <Input
                      value={formData.emirates_id || ''}
                      onChange={(e) => setFormData({ ...formData, emirates_id: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm font-mono">{member.emirates_id || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Passport Number *</Label>
                  {editing ? (
                    <Input
                      value={formData.passport_number || ''}
                      onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm font-mono">{member.passport_number || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Visa Status *</Label>
                  {editing ? (
                    <Select
                      value={formData.visa_status || ''}
                      onValueChange={(v) => setFormData({ ...formData, visa_status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select visa status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employment">Employment</SelectItem>
                        <SelectItem value="residence">Residence</SelectItem>
                        <SelectItem value="investor">Investor</SelectItem>
                        <SelectItem value="dependent">Dependent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm capitalize">{member.visa_status || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Profession / Job Title</Label>
                  {editing ? (
                    <Input
                      value={formData.profession || ''}
                      onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.profession || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  {editing ? (
                    <Input
                      value={formData.company_name || ''}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.company_name || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Work Location</Label>
                  {editing ? (
                    <Input
                      value={formData.work_location || ''}
                      onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.work_location || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Home Country Address & Family Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Permanent Address</Label>
                {editing ? (
                  <Textarea
                    value={formData.home_country_address || ''}
                    onChange={(e) => setFormData({ ...formData, home_country_address: e.target.value })}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm">{member.home_country_address || '-'}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>State</Label>
                  {editing ? (
                    <Input
                      value={formData.home_state || ''}
                      onChange={(e) => setFormData({ ...formData, home_state: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.home_state || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  {editing ? (
                    <Input
                      value={formData.home_district || ''}
                      onChange={(e) => setFormData({ ...formData, home_district: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.home_district || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Panchayath / Municipality</Label>
                  {editing ? (
                    <Input
                      value={formData.home_local_body || ''}
                      onChange={(e) => setFormData({ ...formData, home_local_body: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.home_local_body || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Locality</Label>
                  {editing ? (
                    <Input
                      value={formData.home_local_area_ward || ''}
                      onChange={(e) => setFormData({ ...formData, home_local_area_ward: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.home_local_area_ward || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Ward No.</Label>
                  {editing ? (
                    <Select
                      value={
                        formData.ward_no === null || formData.ward_no === undefined
                          ? ''
                          : String(formData.ward_no)
                      }
                      onValueChange={(value) =>
                        setFormData({ ...formData, ward_no: Number(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ward (1–16 or Other)" />
                      </SelectTrigger>
                      <SelectContent>
                        {WARD_SELECT_OPTIONS.map((ward) => (
                          <SelectItem key={ward.value} value={String(ward.value)}>
                            {ward.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{formatWardNoLabel(member.ward_no)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Home Country Contact Number</Label>
                  {editing ? (
                    <Input
                      value={formData.home_country_contact_number || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, home_country_contact_number: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm">{member.home_country_contact_number || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Spouse Name</Label>
                  {editing ? (
                    <Input
                      value={formData.spouse_name || ''}
                      onChange={(e) => setFormData({ ...formData, spouse_name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{member.spouse_name || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Number of Children</Label>
                  {editing ? (
                    <Input
                      type="number"
                      min={0}
                      value={formData.children_count ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          children_count: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <p className="text-sm">{member.children_count ?? '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Family Residing With You</Label>
                  {editing ? (
                    <Select
                      value={
                        formData.family_residing_with === true
                          ? 'yes'
                          : formData.family_residing_with === false
                          ? 'no'
                          : ''
                      }
                      onValueChange={(v) =>
                        setFormData({ ...formData, family_residing_with: v === 'yes' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      {member.family_residing_with === null
                        ? '-'
                        : member.family_residing_with
                        ? 'Yes'
                        : 'No'}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Children Details</Label>
                {editing ? (
                  <Textarea
                    value={formData.children_details || ''}
                    onChange={(e) => setFormData({ ...formData, children_details: e.target.value })}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm">{member.children_details || '-'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Member Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Member Classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Member Role</Label>
                  {editing ? (
                    <Select
                      value={formData.membership_type || 'member'}
                      onValueChange={(v) => setFormData({ ...formData, membership_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="central_committee">Central Committee</SelectItem>
                        <SelectItem value="secretary">Secretary</SelectItem>
                        <SelectItem value="joint_secretary">Joint Secretary</SelectItem>
                        <SelectItem value="president">President</SelectItem>
                        <SelectItem value="vice_president">Vice President</SelectItem>
                        <SelectItem value="treasurer">Treasurer</SelectItem>
                        <SelectItem value="joint_treasurer">Joint Treasurer</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm capitalize">{member.membership_type.replace(/_/g, ' ')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Membership Plan</Label>
                  {editing ? (
                    <Select
                      value={(formData.membership_plan as string) || 'annual'}
                      onValueChange={(v: 'annual' | 'lifetime') =>
                        setFormData((prev) => ({
                          ...prev,
                          membership_plan: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">
                          Yearly (join 100; to 2019: 25; from 2020: 50)
                        </SelectItem>
                        <SelectItem value="lifetime">Lifetime (AED 750 — no annual dues)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm capitalize">{(member.membership_plan || 'annual').replace('_', ' ')}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Membership Tracking</CardTitle>
              <CardDescription>
                Set join year and tick years paid. For lifetime, set when lifetime started — only
                years before that date (from join) are shown.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <MembershipYearsPicker
                    joinYear={joinYear}
                    paidYears={paidYears}
                    onJoinYearChange={setJoinYear}
                    onPaidYearsChange={setPaidYears}
                    mode={
                      ((formData.membership_plan || member.membership_plan || 'annual') as
                        | 'annual'
                        | 'lifetime')
                    }
                    lifetimeStartDate={lifetimeStartDate}
                    onLifetimeStartDateChange={setLifetimeStartDate}
                  />
                  {(formData.membership_plan || member.membership_plan || 'annual') === 'lifetime' && (
                    <div className="space-y-2">
                      <Label>Lifetime payment status</Label>
                      <Select
                        value={(formData.membership_payment_status as string) || 'unpaid'}
                        onValueChange={(v: 'paid' | 'unpaid') =>
                          setFormData({ ...formData, membership_payment_status: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm capitalize">
                    Plan: {(member.membership_plan || 'annual').replace('_', ' ')}
                  </p>
                  <p className="text-sm">
                    Joined year: <span className="font-medium">{joinYear}</span>
                  </p>
                  {(member.membership_plan || 'annual') === 'lifetime' && (
                    <p className="text-sm">
                      Lifetime started:{' '}
                      <span className="font-medium">
                        {member.lifetime_started_on
                          ? new Date(member.lifetime_started_on).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : lifetimeStartDate
                            ? new Date(lifetimeStartDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                      </span>
                    </p>
                  )}
                  <p className="text-sm">
                    {(member.membership_plan || 'annual') === 'lifetime'
                      ? 'Years paid before lifetime: '
                      : 'Years paid: '}
                    <span className="font-medium">
                      {paidYears.length > 0 ? paidYears.join(', ') : 'None'}
                    </span>
                  </p>
                  {(member.membership_plan || 'annual') === 'lifetime' && (
                    <p className="text-sm capitalize">
                      Lifetime payment: {member.membership_payment_status || 'unpaid'}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                {editing ? (
                  <Textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{member.notes || '-'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Document previews on Details tab */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                <CardDescription>EID, passport, and member photo</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`#documents-tab`} onClick={() => document.getElementById('documents-tab-trigger')?.click()}>
                  View all ({documents.length})
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['emirates_id', 'passport', 'photo'] as const).map((type) => {
                  const doc = getDocumentByType(type);
                  const label =
                    type === 'photo' ? 'Member photo' : type.replace('_', ' ');
                  return (
                    <div key={type} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium capitalize">{label}</p>
                      {doc ? (
                        <>
                          <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                setPreviewDoc(doc);
                                setPreviewOpen(true);
                              }}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-amber-600">Not uploaded</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Document</CardTitle>
              <CardDescription>Add or replace EID, passport, or member photo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Document type</Label>
                  <Select value={docUploadType} onValueChange={setDocUploadType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emirates_id">Emirates ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="photo">Member Photo</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <Button onClick={handleDocumentUpload} disabled={!docUploadFile || uploadingDoc}>
                {uploadingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Documents</CardTitle>
              <CardDescription>Uploaded identity documents and files</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-start sm:items-center justify-between gap-3 p-3 rounded-lg border">
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.file_name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {doc.document_type.replace('_', ' ')} - {format(new Date(doc.created_at), 'PP')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPreviewDoc(doc);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={`/api/documents/file?pathname=${encodeURIComponent(doc.file_path)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          {welfare ? (
            <WelfareMembershipCard
              memberId={member.id}
              welfare={welfare}
              welfareFees={welfareFees}
              onUpdated={fetchMember}
              onToggleFeePaid={handleToggleFeePaid}
              onDeleteFee={handleDeleteFee}
              feeActionLoading={feeActionLoading}
            />
          ) : null}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Fees & Payments</CardTitle>
                <CardDescription>
                  Yearly fees are created automatically. Upgrade to lifetime for a one-time AED 750
                  invoice with no further annual dues.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {(member.membership_plan || 'annual') !== 'lifetime' ? (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={lifetimeLoading}
                    onClick={() => handleLifetimeAction('upgrade')}
                  >
                    {lifetimeLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4 mr-2" />
                    )}
                    Upgrade to Lifetime (AED 750)
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={lifetimeLoading}
                    onClick={() => handleLifetimeAction('revoke')}
                  >
                    {lifetimeLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Remove Lifetime Access
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={feeRecordFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFeeRecordFilter('all')}
                >
                  All ({fees.filter((fee) => !isWelfareFeeRow(fee)).length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={feeRecordFilter === 'unpaid' ? 'default' : 'outline'}
                  onClick={() => setFeeRecordFilter('unpaid')}
                >
                  Unpaid ({unpaidFeesCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={feeRecordFilter === 'paid' ? 'default' : 'outline'}
                  onClick={() => setFeeRecordFilter('paid')}
                >
                  Paid ({paidFeesCount})
                </Button>
              </div>

              {fees.filter((fee) => !isWelfareFeeRow(fee)).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No membership fees recorded yet</p>
              ) : filteredFees.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No {feeRecordFilter} records found for this member
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredFees.map((fee) => (
                    <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border">
                      <div className="min-w-0">
                        <p className="font-medium">{getFeeTypeLabel(fee.fee_type, fee.fee_year, fee.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          Year: {fee.fee_year || '-'} · Due:{' '}
                          {format(new Date(fee.due_date), 'PP')}
                          {fee.paid_date && ` | Paid: ${format(new Date(fee.paid_date), 'PP')}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="font-semibold">
                          {fee.currency} {fee.amount.toLocaleString()}
                        </span>
                        <span className={cn('text-xs px-2 py-1 rounded-full capitalize', getPaymentStatusColor(fee.payment_status))}>
                          {fee.payment_status}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/fees/${fee.id}/invoice`} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />
                            PDF Invoice
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={feeActionLoading === fee.id}
                          onClick={() => handleToggleFeePaid(fee)}
                        >
                          {fee.payment_status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                        </Button>
                        {isUnpaidFee(fee.payment_status) && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={generateUnpaidInvoiceWhatsAppLink(fee)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={feeActionLoading === fee.id}
                          onClick={() => handleDeleteFee(fee)}
                          title="Delete fee"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={lifetimeDialogOpen} onOpenChange={setLifetimeDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upgrade to Lifetime</DialogTitle>
            <DialogDescription>
              Set when lifetime started and tick years already paid from joining until the year
              before that. A 750 lifetime invoice will be created; unpaid yearly dues after that are
              cleared.
            </DialogDescription>
          </DialogHeader>
          <MembershipYearsPicker
            joinYear={joinYear}
            paidYears={paidYears}
            onJoinYearChange={setJoinYear}
            onPaidYearsChange={setPaidYears}
            mode="lifetime"
            lifetimeStartDate={lifetimeStartDate}
            onLifetimeStartDateChange={setLifetimeStartDate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifetimeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmLifetimeUpgrade} disabled={lifetimeLoading}>
              {lifetimeLoading ? 'Upgrading…' : 'Create 750 invoice & upgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(member.whatsapp_number || member.phone) && (
        <a
          href={`https://wa.me/${(member.whatsapp_number || member.phone || '').replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Message on WhatsApp"
          aria-label="Message on WhatsApp"
          className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:bg-[#1ebe57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 lg:bottom-8 lg:right-8"
        >
          <WhatsAppIcon className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}

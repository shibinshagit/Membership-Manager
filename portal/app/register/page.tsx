'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PoweredByOpenCoders } from '@/components/powered-by-opencoders';
import { SubmitProgressPanel } from '@/components/submit-progress-panel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { postFormDataWithProgress } from '@/lib/upload/post-form-data-with-progress';
import { compressFormDataImages } from '@/lib/upload/compress-image-file';
import { WARD_SELECT_OPTIONS } from '@/lib/members/ward-numbers';
import {
  validateRegistrationFields,
  REGISTRATION_FIELD_SECTIONS,
} from '@/lib/members/registration-validation';
import {
  AlertCircle,
  Loader2,
  UserRound,
  Phone,
  IdCard,
  Home,
  BadgeCheck,
  Check,
  Upload,
} from 'lucide-react';
import { AppIcon } from '@/components/icons/app-icon';

type FieldErrors = Record<string, string>;

function getFormFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0 || !value.name) {
    return null;
  }
  return value;
}

const FIELD_SECTIONS = REGISTRATION_FIELD_SECTIONS;

function Field({
  label,
  htmlFor,
  fieldKey,
  required,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  fieldKey?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={fieldKey ? `field-${fieldKey}` : undefined}
      className={cn(
        'space-y-1.5 scroll-mt-36',
        error && 'rounded-lg border border-destructive/30 bg-destructive/5 p-3',
        className
      )}
    >
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="flex items-start gap-1.5 text-xs sm:text-sm font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function FileField({
  label,
  name,
  fieldKey,
  required,
  error,
  photoOnly,
}: {
  label: string;
  name: string;
  fieldKey: string;
  required?: boolean;
  error?: string;
  photoOnly?: boolean;
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const accept = photoOnly
    ? 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png'
    : 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.pdf';
  const emptyHint = photoOnly
    ? { title: 'Tap to upload photo', subtitle: 'Max 5MB · JPG or PNG · smaller photos upload more reliably' }
    : { title: 'Tap to upload photo or PDF', subtitle: 'Max 5MB · JPG, PNG, or PDF · prefer under 2MB' };

  return (
    <Field label={label} fieldKey={fieldKey} required={required} error={error}>
      <div
        className={cn(
          'relative flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 transition-colors',
          error
            ? 'border-destructive/50 bg-destructive/5'
            : selectedName
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
        )}
      >
        {selectedName ? (
          <>
            <Check className="mb-2 h-5 w-5 text-primary" />
            <span className="max-w-full truncate px-1 text-center text-sm font-medium">{selectedName}</span>
            <span className="mt-1 text-xs text-muted-foreground">Tap to change file</span>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
            <span className="text-center text-sm font-medium">{emptyHint.title}</span>
            <span className="mt-1 text-xs text-muted-foreground">{emptyHint.subtitle}</span>
          </>
        )}
        <input
          id={name}
          name={name}
          type="file"
          accept={accept}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setSelectedName(file && file.size > 0 ? file.name : null);
          }}
        />
      </div>
    </Field>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
      {children}
    </p>
  );
}

const inputClass = 'h-11 text-base sm:text-sm';
const selectTriggerClass = 'h-11 w-full';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ percent: 0, label: '' });
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [visaStatus, setVisaStatus] = useState('');
  const [familyResidingWith, setFamilyResidingWith] = useState('');
  const [wardNo, setWardNo] = useState('');
  const [membershipPlan, setMembershipPlan] = useState<'annual' | 'lifetime'>('annual');
  const [openSections, setOpenSections] = useState<string[]>(['personal']);
  const [formReady, setFormReady] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmApplicantName, setConfirmApplicantName] = useState('');
  const pendingFormDataRef = useRef<FormData | null>(null);

  useEffect(() => {
    setFormReady(true);
  }, []);

  const applyErrors = useCallback((errors: FieldErrors, message: string) => {
    setFieldErrors(errors);
    setGeneralError(message);

    const sectionsToOpen = new Set<string>();
    for (const field of Object.keys(errors)) {
      sectionsToOpen.add(FIELD_SECTIONS[field] ?? 'personal');
    }
    if (sectionsToOpen.size > 0) {
      setOpenSections((prev) => [...new Set([...prev, ...sectionsToOpen])]);
    }

    window.setTimeout(() => {
      document.getElementById('register-error-summary')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    formData.set('membership_plan', membershipPlan);
    formData.set('visa_status', visaStatus);
    formData.set('gender', gender);
    formData.set('blood_group', bloodGroup);
    formData.set('marital_status', maritalStatus);
    formData.set('ward_no', wardNo);
    if (familyResidingWith === 'yes') formData.set('family_residing_with', 'true');
    else if (familyResidingWith === 'no') formData.set('family_residing_with', 'false');

    const clientErrors = validateRegistrationFields({
      full_name: formData.get('full_name')?.toString(),
      date_of_birth: formData.get('date_of_birth')?.toString(),
      gender,
      blood_group: bloodGroup,
      marital_status: maritalStatus,
      phone: formData.get('phone')?.toString(),
      whatsapp_number: formData.get('whatsapp_number')?.toString(),
      email: formData.get('email')?.toString(),
      uae_building: formData.get('uae_building')?.toString(),
      uae_area: formData.get('uae_area')?.toString(),
      uae_city: formData.get('uae_city')?.toString(),
      address: formData.get('address')?.toString(),
      emirates_id: formData.get('emirates_id')?.toString(),
      passport_number: formData.get('passport_number')?.toString(),
      visa_status: visaStatus,
      profession: formData.get('profession')?.toString(),
      company_name: formData.get('company_name')?.toString(),
      work_location: formData.get('work_location')?.toString(),
      home_country_address: formData.get('home_country_address')?.toString(),
      home_state: formData.get('home_state')?.toString(),
      home_district: formData.get('home_district')?.toString(),
      home_local_body: formData.get('home_local_body')?.toString(),
      home_local_area_ward: formData.get('home_local_area_ward')?.toString(),
      home_country_contact_number: formData.get('home_country_contact_number')?.toString(),
      family_residing_with:
        familyResidingWith === 'yes' ? 'true' : familyResidingWith === 'no' ? 'false' : '',
      nominee: formData.get('nominee')?.toString(),
      ward_no: wardNo,
      membership_plan: membershipPlan,
      member_id: formData.get('member_id')?.toString(),
      emirates_id_file: getFormFile(formData, 'emirates_id_file'),
      passport_file: getFormFile(formData, 'passport_file'),
      photo_file: getFormFile(formData, 'photo_file'),
    });

    if (Object.keys(clientErrors).length > 0) {
      applyErrors(clientErrors, 'Please fix the highlighted fields below.');
      return;
    }

    pendingFormDataRef.current = formData;
    setConfirmApplicantName(formData.get('full_name')?.toString()?.trim() || '');
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    const formData = pendingFormDataRef.current;
    if (!formData) return;

    setConfirmOpen(false);
    setLoading(true);
    setSubmitProgress({ percent: 0, label: 'Preparing photos...' });

    try {
      const compressedFormData = await compressFormDataImages(formData, [
        'emirates_id_file',
        'passport_file',
        'photo_file',
      ]);

      setSubmitProgress({ percent: 5, label: 'Uploading documents...' });

      const result = await postFormDataWithProgress<{
        error?: string;
        errors?: FieldErrors;
        member?: { member_id: string; full_name: string };
      }>('/api/register', compressedFormData, {
        timeoutMs: 120_000,
        onUploadProgress: (uploadPercent) => {
          setSubmitProgress({
            percent: Math.min(90, 5 + Math.round(uploadPercent * 0.8)),
            label: 'Uploading documents...',
          });
        },
        onProcessing: () => {
          setSubmitProgress({ percent: 92, label: 'Saving your application...' });
        },
      });

      if (!result.ok) {
        applyErrors(
          result.data.errors ?? {},
          result.data.error || 'Failed to submit application. Please check the fields below.'
        );
        setLoading(false);
        return;
      }

      setSubmitProgress({ percent: 100, label: 'Application saved!' });

      router.push(
        `/register/success?ref=${encodeURIComponent(result.data.member!.member_id)}&name=${encodeURIComponent(result.data.member!.full_name)}`
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'An error occurred. Please check your connection and try again.';
      setGeneralError(message);
      setLoading(false);
      window.setTimeout(() => {
        document.getElementById('register-error-summary')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  };

  const err = (name: string) => fieldErrors[name];
  const hasErrors = generalError || Object.keys(fieldErrors).length > 0;

  const scrollToField = (fieldKey: string) => {
    const section = FIELD_SECTIONS[fieldKey];
    if (section) {
      setOpenSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
    }
    window.setTimeout(() => {
      document.getElementById(`field-${fieldKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
  };

  const sections = [
    { id: 'personal', label: 'Personal', icon: UserRound },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'identity', label: 'Identity', icon: IdCard },
    { id: 'family', label: 'Family', icon: Home },
    { id: 'plan', label: 'Plan', icon: BadgeCheck },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 p-0.5 sm:h-12 sm:w-12">
            <img src="/mpa-logo.png" alt="MPA Logo" className="h-full w-full rounded-lg object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">Membership Registration</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Complete all sections below</p>
          </div>
        </div>

        {/* Section nav — scroll on mobile */}
        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 min-w-max">
            {sections.map(({ id, label, icon }, i) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOpenSections((prev) => (prev.includes(id) ? prev : [...prev, id]));
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                  openSections.includes(id)
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold sm:text-xs">
                  {i + 1}
                </span>
                <AppIcon icon={icon} className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6 pb-28 sm:pb-8">
        {!formReady ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
        <form id="register-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {hasErrors && (
            <div
              id="register-error-summary"
              role="alert"
              className="scroll-mt-36 rounded-xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    {generalError || 'Please fix the highlighted fields below.'}
                  </p>
                  {Object.keys(fieldErrors).length > 0 && (
                    <p className="mt-1 text-sm text-destructive/90">
                      {Object.keys(fieldErrors).length} required field
                      {Object.keys(fieldErrors).length === 1 ? '' : 's'} still need attention.{' '}
                      <button
                        type="button"
                        onClick={() => scrollToField(Object.keys(fieldErrors)[0])}
                        className="font-medium underline underline-offset-2"
                      >
                        Go to first
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-3"
          >
            {/* 1. Personal */}
            <AccordionItem
              value="personal"
              id="section-personal"
              className="rounded-xl border bg-background px-4 shadow-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]]:border-b">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">Personal Information</p>
                    <p className="text-xs font-normal text-muted-foreground">All fields required except membership ID</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-5 pt-1">
                <Field
                  label="Membership ID"
                  htmlFor="member_id"
                  fieldKey="member_id"
                  error={err('member_id')}
                >
                  <Input
                    id="member_id"
                    name="member_id"
                    placeholder="Enter your existing ID, or leave blank for a new one"
                    className={cn(inputClass, err('member_id') && 'border-destructive')}
                    aria-invalid={!!err('member_id')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Already have a membership ID? Enter it here. Otherwise one will be assigned after approval.
                  </p>
                </Field>

                <Field
                  label="Full Name (As per Passport)"
                  htmlFor="full_name"
                  fieldKey="full_name"
                  required
                  error={err('full_name')}
                >
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Enter full name"
                    className={cn(inputClass, err('full_name') && 'border-destructive')}
                    aria-invalid={!!err('full_name')}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Date of Birth"
                    htmlFor="date_of_birth"
                    fieldKey="date_of_birth"
                    required
                    error={err('date_of_birth')}
                  >
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      className={cn(inputClass, err('date_of_birth') && 'border-destructive')}
                      aria-invalid={!!err('date_of_birth')}
                    />
                  </Field>
                  <Field
                    label="Nominee"
                    htmlFor="nominee"
                    fieldKey="nominee"
                    required
                    error={err('nominee')}
                  >
                    <Input
                      id="nominee"
                      name="nominee"
                      placeholder="Nominee full name"
                      className={cn(inputClass, err('nominee') && 'border-destructive')}
                      aria-invalid={!!err('nominee')}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Gender" fieldKey="gender" required error={err('gender')}>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className={cn(selectTriggerClass, err('gender') && 'border-destructive')}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Blood Group" fieldKey="blood_group" required error={err('blood_group')}>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
                      <SelectTrigger className={cn(selectTriggerClass, err('blood_group') && 'border-destructive')}>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marital Status" fieldKey="marital_status" required error={err('marital_status')}>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger className={cn(selectTriggerClass, err('marital_status') && 'border-destructive')}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Contact */}
            <AccordionItem
              value="contact"
              id="section-contact"
              className="rounded-xl border bg-background px-4 shadow-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]]:border-b">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Contact & Address</p>
                    <p className="text-xs font-normal text-muted-foreground">Phone, WhatsApp, email & UAE area/city required</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-5 pt-1">
                <div className="space-y-4">
                  <SectionLabel>Phone & Email</SectionLabel>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Phone Number" htmlFor="phone" fieldKey="phone" required error={err('phone')}>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+971 50 123 4567"
                        className={cn(inputClass, err('phone') && 'border-destructive')}
                        aria-invalid={!!err('phone')}
                      />
                    </Field>
                    <Field
                      label="WhatsApp Number"
                      htmlFor="whatsapp_number"
                      fieldKey="whatsapp_number"
                      required
                      error={err('whatsapp_number')}
                    >
                      <Input
                        id="whatsapp_number"
                        name="whatsapp_number"
                        type="tel"
                        inputMode="tel"
                        placeholder="+971 50 123 4567"
                        className={cn(inputClass, err('whatsapp_number') && 'border-destructive')}
                        aria-invalid={!!err('whatsapp_number')}
                      />
                    </Field>
                  </div>
                  <Field label="Email Address" htmlFor="email" fieldKey="email" required error={err('email')}>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      className={cn(inputClass, err('email') && 'border-destructive')}
                      aria-invalid={!!err('email')}
                    />
                  </Field>
                </div>

                <Separator />

                <div className="space-y-4">
                  <SectionLabel>UAE Address</SectionLabel>
                  <Field
                    label="Building / Villa No."
                    htmlFor="uae_building"
                    fieldKey="uae_building"
                    error={err('uae_building')}
                  >
                    <Input
                      id="uae_building"
                      name="uae_building"
                      placeholder="Optional"
                      className={cn(inputClass, err('uae_building') && 'border-destructive')}
                      aria-invalid={!!err('uae_building')}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Area" htmlFor="uae_area" fieldKey="uae_area" required error={err('uae_area')}>
                      <Input
                        id="uae_area"
                        name="uae_area"
                        placeholder="Area"
                        className={cn(inputClass, err('uae_area') && 'border-destructive')}
                        aria-invalid={!!err('uae_area')}
                      />
                    </Field>
                    <Field label="Emirate / City" htmlFor="uae_city" fieldKey="uae_city" required error={err('uae_city')}>
                      <Input
                        id="uae_city"
                        name="uae_city"
                        placeholder="Dubai, Sharjah…"
                        className={cn(inputClass, err('uae_city') && 'border-destructive')}
                        aria-invalid={!!err('uae_city')}
                      />
                    </Field>
                  </div>
                  <Field label="Full Address" htmlFor="address" fieldKey="address" error={err('address')}>
                    <Input
                      id="address"
                      name="address"
                      placeholder="Optional — street address"
                      className={cn(inputClass, err('address') && 'border-destructive')}
                      aria-invalid={!!err('address')}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Identity */}
            <AccordionItem
              value="identity"
              id="section-identity"
              className="rounded-xl border bg-background px-4 shadow-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]]:border-b">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">Identity & Employment</p>
                    <p className="text-xs font-normal text-muted-foreground">ID, documents & profession required — company & work location optional</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-5 pt-1">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Emirates ID"
                    htmlFor="emirates_id"
                    fieldKey="emirates_id"
                    required
                    error={err('emirates_id')}
                  >
                    <Input
                      id="emirates_id"
                      name="emirates_id"
                      placeholder="784-XXXX-XXXXXXX-X"
                      className={cn(inputClass, err('emirates_id') && 'border-destructive')}
                      aria-invalid={!!err('emirates_id')}
                    />
                  </Field>
                  <Field
                    label="Passport Number"
                    htmlFor="passport_number"
                    fieldKey="passport_number"
                    required
                    error={err('passport_number')}
                  >
                    <Input
                      id="passport_number"
                      name="passport_number"
                      placeholder="Passport no."
                      className={cn(inputClass, err('passport_number') && 'border-destructive')}
                      aria-invalid={!!err('passport_number')}
                    />
                  </Field>
                </div>
                <Field label="Visa Status" fieldKey="visa_status" required error={err('visa_status')}>
                  <Select value={visaStatus} onValueChange={setVisaStatus}>
                    <SelectTrigger className={cn(selectTriggerClass, err('visa_status') && 'border-destructive')}>
                      <SelectValue placeholder="Select visa status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employment">Employment</SelectItem>
                      <SelectItem value="residence">Residence</SelectItem>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="dependent">Dependent</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Separator />
                <SectionLabel>Document Uploads</SectionLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FileField
                    label="Emirates ID Photo"
                    name="emirates_id_file"
                    fieldKey="emirates_id_file"
                    required
                    error={err('emirates_id_file')}
                  />
                  <FileField
                    label="Passport Photo"
                    name="passport_file"
                    fieldKey="passport_file"
                    required
                    error={err('passport_file')}
                  />
                  <FileField
                    label="Member Photo"
                    name="photo_file"
                    fieldKey="photo_file"
                    required
                    photoOnly
                    error={err('photo_file')}
                  />
                </div>

                <Separator />
                <SectionLabel>Employment</SectionLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Profession / Job Title"
                    htmlFor="profession"
                    fieldKey="profession"
                    required
                    error={err('profession')}
                  >
                    <Input
                      id="profession"
                      name="profession"
                      placeholder="Your job title"
                      className={cn(inputClass, err('profession') && 'border-destructive')}
                      aria-invalid={!!err('profession')}
                    />
                  </Field>
                  <Field
                    label="Company Name"
                    htmlFor="company_name"
                    fieldKey="company_name"
                    error={err('company_name')}
                  >
                    <Input
                      id="company_name"
                      name="company_name"
                      placeholder="Optional"
                      className={cn(inputClass, err('company_name') && 'border-destructive')}
                      aria-invalid={!!err('company_name')}
                    />
                  </Field>
                  <Field
                    label="Work Location"
                    htmlFor="work_location"
                    fieldKey="work_location"
                    error={err('work_location')}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="work_location"
                      name="work_location"
                      placeholder="Optional"
                      className={cn(inputClass, err('work_location') && 'border-destructive')}
                      aria-invalid={!!err('work_location')}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Family */}
            <AccordionItem
              value="family"
              id="section-family"
              className="rounded-xl border bg-background px-4 shadow-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]]:border-b">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    4
                  </span>
                  <div>
                    <p className="font-semibold">Home Country & Family</p>
                    <p className="text-xs font-normal text-muted-foreground">Permanent address, locality & ward required · state/district optional</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-5 pt-1">
                <Field
                  label="Permanent Address (Home Country)"
                  htmlFor="home_country_address"
                  fieldKey="home_country_address"
                  required
                  error={err('home_country_address')}
                >
                  <Textarea
                    id="home_country_address"
                    name="home_country_address"
                    rows={3}
                    placeholder="Full permanent address"
                    className={cn(
                      'text-base sm:text-sm min-h-[88px] resize-y',
                      err('home_country_address') && 'border-destructive'
                    )}
                    aria-invalid={!!err('home_country_address')}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="State" htmlFor="home_state" fieldKey="home_state" error={err('home_state')}>
                    <Input
                      id="home_state"
                      name="home_state"
                      placeholder="Optional"
                      className={cn(inputClass, err('home_state') && 'border-destructive')}
                      aria-invalid={!!err('home_state')}
                    />
                  </Field>
                  <Field label="District" htmlFor="home_district" fieldKey="home_district" error={err('home_district')}>
                    <Input
                      id="home_district"
                      name="home_district"
                      placeholder="Optional"
                      className={cn(inputClass, err('home_district') && 'border-destructive')}
                      aria-invalid={!!err('home_district')}
                    />
                  </Field>
                  <Field
                    label="Panchayath / Municipality"
                    htmlFor="home_local_body"
                    fieldKey="home_local_body"
                    required
                    error={err('home_local_body')}
                  >
                    <Input
                      id="home_local_body"
                      name="home_local_body"
                      className={cn(inputClass, err('home_local_body') && 'border-destructive')}
                      aria-invalid={!!err('home_local_body')}
                    />
                  </Field>
                  <Field
                    label="Locality"
                    htmlFor="home_local_area_ward"
                    fieldKey="home_local_area_ward"
                    required
                    error={err('home_local_area_ward')}
                  >
                    <Input
                      id="home_local_area_ward"
                      name="home_local_area_ward"
                      className={cn(inputClass, err('home_local_area_ward') && 'border-destructive')}
                      aria-invalid={!!err('home_local_area_ward')}
                    />
                  </Field>
                  <Field label="Ward No." fieldKey="ward_no" required error={err('ward_no')}>
                    <Select value={wardNo} onValueChange={setWardNo}>
                      <SelectTrigger className={cn(selectTriggerClass, err('ward_no') && 'border-destructive')}>
                        <SelectValue placeholder="Select ward (1–16)" />
                      </SelectTrigger>
                      <SelectContent>
                        {WARD_SELECT_OPTIONS.map((ward) => (
                          <SelectItem key={ward.value} value={String(ward.value)}>
                            {ward.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Home Country Contact"
                    htmlFor="home_country_contact_number"
                    fieldKey="home_country_contact_number"
                    required
                    error={err('home_country_contact_number')}
                  >
                    <Input
                      id="home_country_contact_number"
                      name="home_country_contact_number"
                      type="tel"
                      inputMode="tel"
                      className={cn(inputClass, err('home_country_contact_number') && 'border-destructive')}
                      aria-invalid={!!err('home_country_contact_number')}
                    />
                  </Field>
                  <Field label="Family Residing with You" fieldKey="family_residing_with" required error={err('family_residing_with')}>
                    <Select value={familyResidingWith} onValueChange={setFamilyResidingWith}>
                      <SelectTrigger className={cn(selectTriggerClass, err('family_residing_with') && 'border-destructive')}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Spouse Name (optional)" htmlFor="spouse_name">
                    <Input id="spouse_name" name="spouse_name" className={inputClass} />
                  </Field>
                  <Field label="Number of Children (optional)" htmlFor="children_count">
                    <Input id="children_count" name="children_count" type="number" min={0} inputMode="numeric" className={inputClass} />
                  </Field>
                </div>
                <Field label="Children Details (optional)" htmlFor="children_details">
                  <Textarea
                    id="children_details"
                    name="children_details"
                    rows={2}
                    className="text-base sm:text-sm resize-y"
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Plan */}
            <AccordionItem
              value="plan"
              id="section-plan"
              className="rounded-xl border bg-background px-4 shadow-sm sm:px-5"
            >
              <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]]:border-b">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    5
                  </span>
                  <div>
                    <p className="font-semibold">Membership Plan</p>
                    <p className="text-xs font-normal text-muted-foreground">Choose your plan</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pb-5 pt-1">
                <div
                  id="field-membership_plan"
                  className={cn(
                    'space-y-3 scroll-mt-36',
                    err('membership_plan') && 'rounded-lg border border-destructive/30 bg-destructive/5 p-3'
                  )}
                >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(
                    [
                      { value: 'annual' as const, title: 'Yearly', desc: 'Renewed each year' },
                      { value: 'lifetime' as const, title: 'Lifetime', desc: 'One-time membership' },
                    ] as const
                  ).map((plan) => (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => setMembershipPlan(plan.value)}
                      className={cn(
                        'relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all',
                        membershipPlan === plan.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50'
                      )}
                    >
                      {membershipPlan === plan.value && (
                        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="font-semibold">{plan.title}</span>
                      <span className="mt-1 text-xs text-muted-foreground">{plan.desc}</span>
                    </button>
                  ))}
                </div>
                {err('membership_plan') && (
                  <p className="flex items-start gap-1.5 text-sm font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {err('membership_plan')}
                  </p>
                )}
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                  <p className="font-medium">After you submit</p>
                  <p className="mt-1 text-xs sm:text-sm opacity-90">
                    Your application will be reviewed by the committee. Save the reference number on the confirmation page.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Desktop submit */}
          <Button type="submit" className="hidden h-12 w-full text-base sm:flex" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>
        )}

        <PoweredByOpenCoders className="mt-8 text-center text-xs text-muted-foreground" />
      </div>

      {/* Mobile sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {hasErrors && (
          <button
            type="button"
            onClick={() =>
              document.getElementById('register-error-summary')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
            className="mb-3 flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Cannot submit — </span>
              {Object.keys(fieldErrors).length > 0
                ? `${Object.keys(fieldErrors).length} field(s) need attention. Tap to view.`
                : generalError}
            </span>
          </button>
        )}
        <Button type="submit" form="register-form" className="h-12 w-full text-base" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </div>

      <SubmitProgressPanel open={loading} percent={submitProgress.percent} label={submitProgress.label} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your application?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  {confirmApplicantName ? (
                    <>
                      You are about to submit the membership application for{' '}
                      <span className="font-medium text-foreground">{confirmApplicantName}</span>.
                    </>
                  ) : (
                    'You are about to submit your membership application.'
                  )}
                </p>
                <p>
                  Please confirm that all details and uploaded documents are correct. Your
                  application will be sent for committee review and cannot be edited after
                  submission.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmSubmit();
              }}
            >
              Yes, submit application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

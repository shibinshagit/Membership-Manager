'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, Loader2, User, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { SubmitProgressPanel } from '@/components/submit-progress-panel';
import { postFormDataWithProgress } from '@/lib/upload/post-form-data-with-progress';
import { WARD_SELECT_OPTIONS } from '@/lib/members/ward-numbers';
import { MembershipYearsPicker } from '@/components/members/membership-years-picker';
import { currentCalendarYear } from '@/lib/fees-calendar';

export default function NewMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ percent: 0, label: '' });
  const [error, setError] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberStatus, setMemberStatus] = useState('pending');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [visaStatus, setVisaStatus] = useState('');
  const [familyResidingWith, setFamilyResidingWith] = useState('');
  const [wardNo, setWardNo] = useState('');
  const [membershipPlan, setMembershipPlan] = useState<'annual' | 'lifetime'>('annual');
  const [membershipPaymentStatus, setMembershipPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [joinYear, setJoinYear] = useState(currentCalendarYear());
  const [paidYears, setPaidYears] = useState<number[]>([]);
  const [lifetimeStartDate, setLifetimeStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [emiratesIdFile, setEmiratesIdFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const uploadDocument = async (
    memberDbId: number,
    documentType: string,
    file: File,
    onFileProgress?: (percent: number) => void
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('member_id', String(memberDbId));
    fd.append('document_type', documentType);
    const result = await postFormDataWithProgress<{ error?: string }>('/api/documents', fd, {
      onUploadProgress: onFileProgress,
      onProcessing: () => onFileProgress?.(100),
    });
    if (!result.ok) {
      throw new Error(result.data.error || `Failed to upload ${documentType}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!memberRole) {
      setError('Please select member role');
      return;
    }

    if (!visaStatus) {
      setError('Please select visa status');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const whatsapp = (formData.get('whatsapp_number') as string)?.trim();
    const emiratesId = (formData.get('emirates_id') as string)?.trim();
    const passport = (formData.get('passport_number') as string)?.trim();
    const nominee = (formData.get('nominee') as string)?.trim();

    if (!whatsapp) {
      setError('WhatsApp number is required');
      return;
    }
    if (!emiratesId) {
      setError('Emirates ID is required');
      return;
    }
    if (!passport) {
      setError('Passport number is required');
      return;
    }
    if (!nominee) {
      setError('Nominee is required');
      return;
    }
    if (!wardNo) {
      setError('Ward number is required');
      return;
    }

    const data = {
      member_id: formData.get('member_id') || null,
      full_name: formData.get('full_name'),
      gender: gender || null,
      blood_group: bloodGroup || null,
      marital_status: maritalStatus || null,
      email: formData.get('email') || null,
      phone: formData.get('phone'),
      whatsapp_number: whatsapp,
      date_of_birth: formData.get('date_of_birth') || null,
      nominee,
      ward_no: Number(wardNo),
      emirates_id: formData.get('emirates_id') || null,
      passport_number: formData.get('passport_number') || null,
      visa_status: visaStatus || null,
      profession: formData.get('profession') || null,
      company_name: formData.get('company_name') || null,
      work_location: formData.get('work_location') || null,
      address: formData.get('address') || null,
      uae_building: formData.get('uae_building') || null,
      uae_area: formData.get('uae_area') || null,
      uae_city: formData.get('uae_city') || null,
      home_country_address: formData.get('home_country_address') || null,
      home_state: formData.get('home_state') || null,
      home_district: formData.get('home_district') || null,
      home_local_body: formData.get('home_local_body') || null,
      home_local_area_ward: formData.get('home_local_area_ward') || null,
      home_country_contact_number: formData.get('home_country_contact_number') || null,
      spouse_name: formData.get('spouse_name') || null,
      children_count: formData.get('children_count') || null,
      children_details: formData.get('children_details') || null,
      family_residing_with:
        familyResidingWith === 'yes' ? true : familyResidingWith === 'no' ? false : null,
      membership_type: memberRole,
      membership_plan: membershipPlan,
      membership_payment_status:
        membershipPlan === 'lifetime'
          ? membershipPaymentStatus
          : paidYears.includes(currentCalendarYear())
            ? 'paid'
            : 'unpaid',
      join_year: joinYear,
      paid_years: paidYears,
      lifetime_start_date: membershipPlan === 'lifetime' ? lifetimeStartDate : undefined,
      status: memberStatus,
      joined_date: `${joinYear}-01-01`,
      membership_start_date:
        membershipPlan === 'lifetime' ? lifetimeStartDate : `${joinYear}-01-01`,
      membership_end_date:
        membershipPlan === 'lifetime' ? null : `${currentCalendarYear()}-12-31`,
      notes: formData.get('notes') || null,
    };

    setLoading(true);
    setSubmitProgress({ percent: 5, label: 'Saving member details...' });

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        const messages = result.errors
          ? Object.values(result.errors as Record<string, string>).join(' ')
          : result.error || 'Failed to create member';
        setError(messages);
        setLoading(false);
        return;
      }

      const memberDbId = result.member.id as number;
      const uploads = [
        { file: emiratesIdFile, type: 'emirates_id', label: 'Emirates ID photo' },
        { file: passportFile, type: 'passport', label: 'Passport photo' },
        { file: photoFile, type: 'photo', label: 'Member photo' },
      ].filter((item): item is { file: File; type: string; label: string } => item.file !== null);

      if (uploads.length === 0) {
        setSubmitProgress({ percent: 100, label: 'Member saved!' });
        router.push(`/dashboard/members/${memberDbId}`);
        return;
      }

      setSubmitProgress({ percent: 25, label: 'Member saved. Uploading documents...' });

      const stepSize = 70 / uploads.length;
      let basePercent = 25;

      try {
        for (const upload of uploads) {
          setSubmitProgress({ percent: basePercent, label: `Uploading ${upload.label}...` });
          await uploadDocument(memberDbId, upload.type, upload.file, (filePercent) => {
            setSubmitProgress({
              percent: Math.min(95, basePercent + (filePercent / 100) * stepSize),
              label: `Uploading ${upload.label}...`,
            });
          });
          basePercent += stepSize;
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? `${uploadError.message}. Member was created ù upload documents from their profile.`
            : 'Member created but document upload failed.'
        );
        setLoading(false);
        router.push(`/dashboard/members/${memberDbId}`);
        return;
      }

      setSubmitProgress({ percent: 100, label: 'All done!' });
      router.push(`/dashboard/members/${memberDbId}`);
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/members">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Add New Member</h1>
          <p className="text-muted-foreground mt-1">Fill in the member details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Basic member details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member_id">Membership ID</Label>
              <Input
                id="member_id"
                name="member_id"
                placeholder="Enter existing ID, or leave blank to auto-generate"
              />
              <p className="text-xs text-muted-foreground">
                Use this for members who already have a membership ID.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name (As per Passport) *</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select value={bloodGroup} onValueChange={setBloodGroup}>
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
              </div>
              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select value={maritalStatus} onValueChange={setMaritalStatus}>
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
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nominee">Nominee *</Label>
                <Input
                  id="nominee"
                  name="nominee"
                  placeholder="Nominee full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Enter address"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="w-5 h-5" />
              Contact Information
            </CardTitle>
            <CardDescription>Phone and email details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="uae_building">Building / Villa No.</Label>
                <Input id="uae_building" name="uae_building" placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uae_area">Area</Label>
                <Input id="uae_area" name="uae_area" placeholder="Area" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uae_city">Emirate / City</Label>
                <Input id="uae_city" name="uae_city" placeholder="City or Emirate" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp Number *</Label>
                <Input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="member@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Identity Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="w-5 h-5" />
              Identity Documents
            </CardTitle>
            <CardDescription>EID, passport, member photo and employment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emirates_id">Emirates ID *</Label>
                <Input
                  id="emirates_id"
                  name="emirates_id"
                  placeholder="784-XXXX-XXXXXXX-X"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passport_number">Passport Number *</Label>
                <Input
                  id="passport_number"
                  name="passport_number"
                  placeholder="Enter passport number"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Visa Status *</Label>
                <Select value={visaStatus} onValueChange={setVisaStatus} required>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession">Profession / Job Title</Label>
                <Input id="profession" name="profession" placeholder="Profession or job title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input id="company_name" name="company_name" placeholder="Company name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_location">Work Location</Label>
                <Input id="work_location" name="work_location" placeholder="Work location" />
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Document Uploads (optional)</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, or PDF ù max 5MB each</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="emirates_id_file">Emirates ID Photo</Label>
                  <Input
                    id="emirates_id_file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setEmiratesIdFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passport_file">Passport Photo</Label>
                  <Input
                    id="passport_file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo_file">Member Photo</Label>
                  <Input
                    id="photo_file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Home Country Address & Family Details</CardTitle>
            <CardDescription>Permanent address and dependent information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="home_country_address">Permanent Address</Label>
              <Textarea id="home_country_address" name="home_country_address" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="home_state">State</Label>
                <Input id="home_state" name="home_state" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_district">District</Label>
                <Input id="home_district" name="home_district" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_local_body">Panchayath / Municipality</Label>
                <Input id="home_local_body" name="home_local_body" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_local_area_ward">Locality</Label>
                <Input id="home_local_area_ward" name="home_local_area_ward" />
              </div>
              <div className="space-y-2">
                <Label>Ward No. *</Label>
                <Select value={wardNo} onValueChange={setWardNo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ward (1ù16)" />
                  </SelectTrigger>
                  <SelectContent>
                    {WARD_SELECT_OPTIONS.map((ward) => (
                      <SelectItem key={ward.value} value={String(ward.value)}>
                        {ward.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_country_contact_number">Home Country Contact Number</Label>
                <Input id="home_country_contact_number" name="home_country_contact_number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spouse_name">Spouse Name</Label>
                <Input id="spouse_name" name="spouse_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="children_count">Number of Children</Label>
                <Input id="children_count" name="children_count" type="number" min={0} />
              </div>
              <div className="space-y-2">
                <Label>Family Members Residing with You</Label>
                <Select value={familyResidingWith} onValueChange={setFamilyResidingWith}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="children_details">Children Details (age / school grade)</Label>
              <Textarea id="children_details" name="children_details" rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Member Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5" />
              Member Classification
            </CardTitle>
            <CardDescription>Role and plan selection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="membership_type">Member Role</Label>
                <Select value={memberRole} onValueChange={setMemberRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
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
              </div>
              <div className="space-y-2">
                <Label>Membership Plan</Label>
                <Select
                  value={membershipPlan}
                  onValueChange={(value: 'annual' | 'lifetime') => setMembershipPlan(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Yearly (AED 50 / calendar year)</SelectItem>
                    <SelectItem value="lifetime">Lifetime (AED 750 ù no annual dues)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Membership Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Membership Tracking</CardTitle>
            <CardDescription>
              Set join year and tick years already collected. For lifetime, set when lifetime
              started and only mark years before that date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MembershipYearsPicker
              joinYear={joinYear}
              paidYears={paidYears}
              onJoinYearChange={setJoinYear}
              onPaidYearsChange={setPaidYears}
              mode={membershipPlan}
              lifetimeStartDate={lifetimeStartDate}
              onLifetimeStartDateChange={setLifetimeStartDate}
            />
            {membershipPlan === 'lifetime' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Lifetime members pay 750 once and have no further yearly billing.
                </p>
                <Label>Lifetime payment status</Label>
                <Select
                  value={membershipPaymentStatus}
                  onValueChange={(value: 'paid' | 'unpaid') => setMembershipPaymentStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={memberStatus} onValueChange={setMemberStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional notes about this member..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 justify-end">
          <Button variant="outline" type="button" asChild>
            <Link href="/dashboard/members">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Member'
            )}
          </Button>
        </div>
      </form>

      <SubmitProgressPanel open={loading} percent={submitProgress.percent} label={submitProgress.label} />
    </div>
  );
}

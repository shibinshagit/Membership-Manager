'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { AppIcon } from '@/components/icons/app-icon';
import { IconTile } from '@/components/icons/icon-tile';
import { Network, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  DataList,
  DataListEmpty,
  DataListHead,
  DataListLoading,
  DataListRow,
  DataListScroll,
  StatusBadge,
  COMMITTEE_LIST_COLS,
} from '@/components/dashboard/data-list';

interface MemberOption {
  id: number;
  member_id: string;
  full_name: string;
  membership_type: string;
  status: string;
}

interface CommitteeMember {
  id: number;
  member_id: string;
  full_name: string;
  membership_type: string;
}

interface Committee {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  member_count: number;
  members: CommitteeMember[];
}

const INITIAL_FORM = {
  name: '',
  description: '',
  status: 'active' as 'active' | 'inactive',
};

export default function CommitteePage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const filteredMembers = useMemo(() => {
    const pattern = memberSearch.trim().toLowerCase();
    if (!pattern) return members;
    return members.filter(
      (member) =>
        member.full_name.toLowerCase().includes(pattern) ||
        member.member_id.toLowerCase().includes(pattern) ||
        member.membership_type.toLowerCase().includes(pattern)
    );
  }, [members, memberSearch]);

  const fetchMembers = async () => {
    const res = await fetch('/api/members?limit=500&page=1');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch members');
    }
    setMembers(data.members || []);
  };

  const fetchCommittees = async () => {
    const res = await fetch('/api/committees');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch committees');
    }
    setCommittees(data.committees || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMembers(), fetchCommittees()]);
    } catch (error) {
      console.error('Error loading committee page:', error);
      setMessage('Failed to load committee data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedMemberIds([]);
    setEditingId(null);
    setMemberSearch('');
  };

  const toggleMember = (memberId: number, checked: boolean) => {
    setSelectedMemberIds((prev) =>
      checked ? [...new Set([...prev, memberId])] : prev.filter((id) => id !== memberId)
    );
  };

  const startEdit = (committee: Committee) => {
    setEditingId(committee.id);
    setForm({
      name: committee.name,
      description: committee.description || '',
      status: committee.status,
    });
    setSelectedMemberIds(committee.members.map((member) => member.id));
    setMessage(`Editing "${committee.name}"`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage('Committee name is required.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        member_ids: selectedMemberIds,
      };
      const endpoint = editingId ? `/api/committees/${editingId}` : '/api/committees';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save committee');
      }

      await fetchCommittees();
      setMessage(editingId ? 'Committee updated successfully.' : 'Committee created successfully.');
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save committee.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (committee: Committee) => {
    const confirmed = window.confirm(`Delete committee "${committee.name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/committees/${committee.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete committee');
      }
      await fetchCommittees();
      if (editingId === committee.id) {
        resetForm();
      }
      setMessage('Committee deleted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete committee.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Committee Management"
        description="Create committees like Arts, Sports, Welfare and assign members to each."
        actions={
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-sm text-muted-foreground">
            <IconTile icon={Network} size="sm" />
            {committees.length} committees
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTile icon={editingId ? Pencil : Plus} size="sm" />
              {editingId ? 'Edit Committee' : 'Create Committee'}
            </CardTitle>
            <CardDescription>
              Define a committee and select members who belong to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="committee-name">Committee Name</Label>
                <Input
                  id="committee-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g., Arts Committee"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="committee-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: 'active' | 'inactive') =>
                    setForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="committee-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="committee-description">Description</Label>
                <Textarea
                  id="committee-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Optional details about this committee"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-search">Assign Members</Label>
                <Input
                  id="member-search"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by name, member ID, or role"
                />
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading members...</div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No matching members found.</div>
                  ) : (
                    filteredMembers.map((member) => {
                      const checked = selectedMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleMember(member.id, value === true)}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.member_id} • {member.membership_type.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected members: {selectedMemberIds.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Committee' : 'Create Committee'}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Committees</h2>
            <p className="text-sm text-muted-foreground">
              Review committees and manage assigned members.
            </p>
          </div>
          {message ? (
            <p className="rounded-lg border border-border/80 bg-card px-3 py-2 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
          <DataList>
            {loading ? (
              <DataListLoading />
            ) : committees.length === 0 ? (
              <DataListEmpty
                icon={Network}
                title="No committees yet"
                description="Create your first one from the left panel."
              />
            ) : (
              <DataListScroll minWidth="48rem">
                <DataListHead
                  className={COMMITTEE_LIST_COLS}
                  columns={[
                    { key: 'name', label: 'Committee' },
                    { key: 'status', label: 'Status' },
                    { key: 'count', label: 'Members' },
                    { key: 'preview', label: 'Preview' },
                    { key: 'actions', label: 'Actions', className: 'text-right' },
                  ]}
                />
                {committees.map((committee) => (
                  <DataListRow key={committee.id} className={COMMITTEE_LIST_COLS}>
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate font-medium">{committee.name}</p>
                      {committee.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {committee.description}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <StatusBadge
                        tone={committee.status === 'active' ? 'success' : 'neutral'}
                      >
                        {committee.status}
                      </StatusBadge>
                    </div>
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {committee.member_count}
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
                      {committee.members.slice(0, 3).map((member) => (
                        <StatusBadge key={member.id} tone="neutral" className="normal-case">
                          {member.full_name}
                        </StatusBadge>
                      ))}
                      {committee.members.length > 3 ? (
                        <StatusBadge tone="neutral">
                          +{committee.members.length - 3} more
                        </StatusBadge>
                      ) : null}
                      {committee.members.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No members</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-2 !overflow-visible">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => startEdit(committee)}
                      >
                        <AppIcon icon={Pencil} className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(committee)}
                      >
                        <AppIcon icon={Trash2} className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </DataListRow>
                ))}
              </DataListScroll>
            )}
          </DataList>
        </div>
      </div>
    </div>
  );
}

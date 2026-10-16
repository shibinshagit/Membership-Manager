'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTile } from '@/components/icons/icon-tile';
import { UsersRound, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  APP_PAGES,
  ALL_APP_PAGE_KEYS,
  ALL_WRITABLE_PAGE_KEYS,
  WRITABLE_APP_PAGES,
  type AppPageKey,
  type ManageableRole,
} from '@/lib/auth/permissions';

type PortalUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  allowed_pages: AppPageKey[] | null;
  writable_pages: AppPageKey[] | null;
  created_at?: string;
};

type UserFormState = {
  full_name: string;
  email: string;
  password: string;
  role: ManageableRole;
  allowed_pages: AppPageKey[];
  writable_pages: AppPageKey[];
  is_active: boolean;
};

const emptyForm = (): UserFormState => ({
  full_name: '',
  email: '',
  password: '',
  role: 'viewer',
  allowed_pages: [...ALL_APP_PAGE_KEYS],
  writable_pages: [],
  is_active: true,
});

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function pageLabels(keys: AppPageKey[]) {
  return keys.map((k) => APP_PAGES.find((p) => p.key === k)?.label || k).join(', ');
}

export function UsersManagement({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortalUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load users');
        return;
      }
      setUsers(data.users || []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (user: PortalUser) => {
    setEditing(user);
    const role: ManageableRole =
      user.role === 'super_admin' ||
      user.role === 'editor' ||
      user.role === 'viewer' ||
      user.role === 'welfare'
        ? user.role
        : 'viewer';
    const allowed =
      role === 'super_admin'
        ? [...ALL_APP_PAGE_KEYS]
        : user.allowed_pages?.length
          ? user.allowed_pages
          : [...ALL_APP_PAGE_KEYS];
    const writable =
      role === 'super_admin'
        ? [...ALL_WRITABLE_PAGE_KEYS]
        : role === 'editor'
          ? (user.writable_pages || []).filter((k) => allowed.includes(k))
          : [];
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role,
      allowed_pages: allowed,
      writable_pages: writable,
      is_active: user.is_active,
    });
    setDialogOpen(true);
  };

  const togglePage = (key: AppPageKey, checked: boolean) => {
    setForm((prev) => {
      const allowed = checked
        ? Array.from(new Set([...prev.allowed_pages, key]))
        : prev.allowed_pages.filter((p) => p !== key);
      const writable = prev.writable_pages.filter((p) => allowed.includes(p));
      return { ...prev, allowed_pages: allowed, writable_pages: writable };
    });
  };

  const toggleWritable = (key: AppPageKey, checked: boolean) => {
    setForm((prev) => {
      if (!prev.allowed_pages.includes(key)) return prev;
      const writable = checked
        ? Array.from(new Set([...prev.writable_pages, key]))
        : prev.writable_pages.filter((p) => p !== key);
      return { ...prev, writable_pages: writable };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (!form.full_name.trim() || !form.email.trim()) {
        setError('Name and email are required');
        setSaving(false);
        return;
      }
      if (!editing && !form.password) {
        setError('Password is required for new users');
        setSaving(false);
        return;
      }
      if (form.role !== 'super_admin' && form.allowed_pages.length === 0) {
        setError('Select at least one page');
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
        allowed_pages: form.role === 'super_admin' ? ALL_APP_PAGE_KEYS : form.allowed_pages,
        writable_pages:
          form.role === 'super_admin'
            ? ALL_WRITABLE_PAGE_KEYS
            : form.role === 'editor'
              ? form.writable_pages
              : [],
        is_active: form.is_active,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(editing ? `/api/users/${editing.id}` : '/api/users', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save user');
        setSaving(false);
        return;
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch {
      setError('Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: PortalUser) => {
    if (user.id === currentUserId) {
      setError('You cannot delete your own account');
      return;
    }
    if (user.role === 'super_admin') {
      setError('Super admin accounts cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete user ${user.full_name}?`)) return;
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete user');
        return;
      }
      await fetchUsers();
    } catch {
      setError('Failed to delete user');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <IconTile icon={UsersRound} size="sm" />
            <CardTitle className="text-base">Manage users</CardTitle>
          </div>
          <CardDescription>
            Super admin: full access. Editor: view selected pages and add/edit where checked.
            Viewer: view only.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add user
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No users yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{user.full_name}</p>
                    <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'}>
                      {formatRole(user.role)}
                    </Badge>
                    {!user.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  {user.role === 'viewer' || user.role === 'editor' ? (
                    <p className="text-xs text-muted-foreground">
                      View:{' '}
                      {pageLabels(
                        user.allowed_pages?.length ? user.allowed_pages : ALL_APP_PAGE_KEYS
                      )}
                    </p>
                  ) : null}
                  {user.role === 'editor' ? (
                    <p className="text-xs text-muted-foreground">
                      Add/edit:{' '}
                      {user.writable_pages?.length
                        ? pageLabels(user.writable_pages)
                        : 'None'}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {user.role !== 'super_admin' && user.id !== currentUserId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update name, role, password, pages, and edit permissions.'
                : 'Create a login with name, email, password, and role.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user_full_name">Name</Label>
              <Input
                id="user_full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_email">Email</Label>
              <Input
                id="user_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_password">
                Password {editing ? '(leave blank to keep)' : ''}
              </Label>
              <Input
                id="user_password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? '••••••••' : 'Min 6 characters'}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  const role = v as ManageableRole;
                  setForm({
                    ...form,
                    role,
                    allowed_pages:
                      role === 'welfare'
                        ? ['members']
                        : role === 'super_admin'
                          ? [...ALL_APP_PAGE_KEYS]
                          : form.allowed_pages,
                    writable_pages:
                      role === 'super_admin'
                        ? [...ALL_WRITABLE_PAGE_KEYS]
                        : role === 'welfare'
                          ? []
                        : role === 'editor'
                          ? form.writable_pages.length
                            ? form.writable_pages
                            : [...ALL_WRITABLE_PAGE_KEYS].filter((k) =>
                                form.allowed_pages.includes(k)
                              )
                          : [],
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super admin — full access</SelectItem>
                  <SelectItem value="editor">Editor — add & edit on selected pages</SelectItem>
                  <SelectItem value="viewer">Viewer — view only</SelectItem>
                  <SelectItem value="welfare">Women & welfare — members only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === 'super_admin' ? (
              <p className="text-xs text-muted-foreground">
                Super admins always see every page and can edit everything.
              </p>
            ) : form.role === 'welfare' ? (
              <p className="text-xs text-muted-foreground">
                This login only opens the members list, limited to women and welfare members.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label>Page access (view)</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uncheck pages to hide them from this user.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {APP_PAGES.map((page) => {
                      const checked = form.allowed_pages.includes(page.key);
                      return (
                        <label
                          key={page.key}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => togglePage(page.key, v === true)}
                          />
                          {page.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {form.role === 'editor' ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Add / edit permissions</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only pages this user can view are listed. Check to allow create and edit.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {WRITABLE_APP_PAGES.filter((page) =>
                        form.allowed_pages.includes(page.key)
                      ).map((page) => {
                        const checked = form.writable_pages.includes(page.key);
                        return (
                          <label
                            key={page.key}
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleWritable(page.key, v === true)}
                            />
                            {page.label}
                          </label>
                        );
                      })}
                    </div>
                    {WRITABLE_APP_PAGES.every((p) => !form.allowed_pages.includes(p.key)) ? (
                      <p className="text-xs text-muted-foreground">
                        Enable at least one content page above to grant edit access.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {editing ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                />
                Account active
              </label>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

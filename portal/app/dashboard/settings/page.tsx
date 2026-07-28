'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { UserRound, KeyRound, Building2, ShieldCheck, Database, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { IconTile } from '@/components/icons/icon-tile'

interface UserProfile {
  id: string
  username: string
  email: string
  full_name: string
  role: string
  created_at: string
}

interface DataStatus {
  imported: boolean
  importedAt: string | null
  storage?: {
    mode: string
    documentsOnDisk: boolean
    documentsPath: string
    databaseHost: string
    databaseName: string
    note: string
  }
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null)
  const [importing, setImporting] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const dumpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchDataStatus()
    }
  }, [user?.role])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setFormData({
          full_name: data.user.full_name || '',
          email: data.user.email || '',
        })
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDataStatus = async () => {
    try {
      const res = await fetch('/api/settings/data')
      if (res.ok) {
        setDataStatus(await res.json())
      }
    } catch (error) {
      console.error('Error fetching data status:', error)
    }
  }

  const handleUpdateProfile = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setSuccess('Profile updated successfully')
        fetchUser()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update profile')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setChangingPassword(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      })

      if (res.ok) {
        setSuccess('Password changed successfully')
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        })
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to change password')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleImportDump = async (file: File | null) => {
    if (!file) return
    setImporting(true)
    setError('')
    setSuccess('')
    try {
      const body = new FormData()
      body.append('dump', file)
      const res = await fetch('/api/settings/data', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to import dump')
        return
      }
      setDataStatus(data)
      setSuccess('Database dump imported. Please log in again with an account from the dump.')
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch {
      setError('An error occurred while importing')
    } finally {
      setImporting(false)
      if (dumpInputRef.current) dumpInputRef.current.value = ''
    }
  }

  const handleDeleteData = async () => {
    const confirmed = window.confirm(
      'Delete ALL membership data? This removes members, fees, documents metadata, and local files. You can import a dump again afterwards. You will be logged out.'
    )
    if (!confirmed) return

    setDeletingData(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/settings/data', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete data')
        return
      }
      setDataStatus(data)
      setSuccess(data.message || 'Data deleted')
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch {
      setError('An error occurred while deleting data')
    } finally {
      setDeletingData(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
      />

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconTile icon={UserRound} size="sm" />
              <CardTitle className="text-base">Profile Information</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={user?.username || ''} disabled />
                <p className="text-xs text-muted-foreground">Username cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleUpdateProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconTile icon={ShieldCheck} size="sm" />
              <CardTitle>Role & Permissions</CardTitle>
            </div>
            <CardDescription>Your current role and access level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
              <Badge variant="default" className="capitalize text-sm px-3 py-1">
                {user?.role?.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {user?.role === 'super_admin' && 'Full access to all features and settings'}
                {user?.role === 'admin' && 'Can manage members, fees, and documents'}
                {user?.role === 'executive' && 'Can view and manage assigned members only'}
              </span>
            </div>
          </CardContent>
        </Card>

        {user?.role === 'super_admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconTile icon={Database} size="sm" />
                <CardTitle>Data import</CardTitle>
              </div>
              <CardDescription>
                After installation, import a `.sql` dump once to seed the local database. Delete data
                to allow another import.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Import status</span>
                  <Badge variant={dataStatus?.imported ? 'default' : 'secondary'}>
                    {dataStatus?.imported ? 'Seeded' : 'Not imported'}
                  </Badge>
                </div>
                {dataStatus?.importedAt && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Imported at</span>
                    <span>{new Date(dataStatus.importedAt).toLocaleString()}</span>
                  </div>
                )}
                {dataStatus?.storage && (
                  <>
                    <Separator />
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Database</span>
                      <span className="text-right font-mono text-xs">
                        {dataStatus.storage.databaseName || '—'} @ {dataStatus.storage.databaseHost}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Document files</span>
                      <span className="text-right font-mono text-xs break-all max-w-[60%]">
                        {dataStatus.storage.documentsPath}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">{dataStatus.storage.note}</p>
                  </>
                )}
              </div>

              {!dataStatus?.imported ? (
                <div className="space-y-3">
                  <input
                    ref={dumpInputRef}
                    type="file"
                    accept=".sql,application/sql,text/plain"
                    className="hidden"
                    onChange={(e) => handleImportDump(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    disabled={importing}
                    onClick={() => dumpInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {importing ? 'Importing dump…' : 'Upload database dump (.sql)'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Only one import is allowed. Document image/PDF files are separate — copy the
                    `documents/` folder from your blob backup into the document files path above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Dump already imported. To upload another dump, delete all data first.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingData}
                    onClick={handleDeleteData}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingData ? 'Deleting…' : 'Delete all data'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconTile icon={KeyRound} size="sm" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, current_password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, new_password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirm_password: e.target.value })
                  }
                />
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconTile icon={Building2} size="sm" />
              <CardTitle>System Information</CardTitle>
            </div>
            <CardDescription>Membership Management System details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-medium">1.0.0</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Account Created</dt>
                <dd className="font-medium">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs">{user?.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

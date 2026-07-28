'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ExecutiveMember {
  id: number;
  member_id: string;
  full_name: string;
  membership_type: string;
  status: string;
  phone: string;
  email: string | null;
  joined_date: string | null;
}

interface AssignedMember {
  id: number;
  member_id: string;
  full_name: string;
  status: string;
  phone: string;
  membership_type: string;
}

export default function ExecutiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [executive, setExecutive] = useState<ExecutiveMember | null>(null);
  const [members, setMembers] = useState<AssignedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [executiveRes, membersRes] = await Promise.all([
        fetch(`/api/members/${resolvedParams.id}`),
        fetch(`/api/members?executive_id=${resolvedParams.id}&limit=1000`),
      ]);

      const executiveData = await executiveRes.json();
      const membersData = await membersRes.json();

      if (!executiveRes.ok) {
        setError(executiveData.error || 'Failed to fetch executive details');
        return;
      }

      setExecutive(executiveData.member);
      setMembers(membersData.members || []);
    } catch {
      setError('An error occurred while loading executive details');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!executive) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Executive not found</h2>
        <p className="text-muted-foreground mt-2">{error || 'No executive record found'}</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/executives">Back to Executive Members</Link>
        </Button>
      </div>
    );
  }

  const isActive = executive.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/executives">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground break-words">{executive.full_name}</h1>
          <p className="text-muted-foreground mt-1">
            {executive.member_id} - {executive.membership_type.replace('_', ' ')} member
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members Under {executive.membership_type.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={cn('text-xs px-2 py-1 rounded-full', isActive ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-600')}>
              {isActive ? 'Active' : executive.status}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Joined</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {executive.joined_date ? format(new Date(executive.joined_date), 'PP') : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Executive Details</CardTitle>
          <CardDescription>Profile information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Full Name</p>
            <p className="font-medium">{executive.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member ID</p>
            <p className="font-medium font-mono">{executive.member_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">{executive.phone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{executive.email || '-'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Members Under This Executive
          </CardTitle>
          <CardDescription>All assigned members</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No members assigned yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm">{member.member_id}</TableCell>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{member.phone}</TableCell>
                      <TableCell>
                        <span className={cn('text-xs px-2 py-1 rounded-full capitalize', member.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground')}>
                          {member.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/members/${member.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

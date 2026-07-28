'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppIcon } from '@/components/icons/app-icon';
import {
  CENTRAL_COMMITTEE_ROLES,
  DASHBOARD_NAV_ICONS,
  DEFAULT_CENTRAL_COMMITTEE_ROLE,
} from '@/lib/members/central-committee-roles';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'president' | 'secretary' | 'central_committee' | 'executive' | 'member';
}

type NavChild = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  children?: NavChild[];
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: DASHBOARD_NAV_ICONS.dashboard,
        exact: true,
      },
    ],
  },
  {
    label: 'Membership',
    items: [
      { name: 'Members', href: '/dashboard/members', icon: DASHBOARD_NAV_ICONS.members },
      { name: 'Documents', href: '/dashboard/documents', icon: DASHBOARD_NAV_ICONS.documents },
      { name: 'Fees & Payments', href: '/dashboard/fees', icon: DASHBOARD_NAV_ICONS.fees },
    ],
  },
  {
    label: 'Organization',
    items: [
      {
        name: 'Central Committee',
        href: `/dashboard/executives?role=${DEFAULT_CENTRAL_COMMITTEE_ROLE}`,
        icon: DASHBOARD_NAV_ICONS.centralCommittee,
        adminOnly: true,
        children: CENTRAL_COMMITTEE_ROLES.map((role) => ({
          name: role.label,
          href: `/dashboard/executives?role=${role.value}`,
          icon: role.icon,
        })),
      },
      {
        name: 'Committee',
        href: '/dashboard/committee',
        icon: DASHBOARD_NAV_ICONS.committee,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        name: 'Settings',
        href: '/dashboard/settings',
        icon: DASHBOARD_NAV_ICONS.settings,
        adminOnly: true,
      },
    ],
  },
];

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function isNavActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  const basePath = item.href.split('?')[0];
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isChildActive(pathname: string, searchParams: URLSearchParams, href: string) {
  const [path, query = ''] = href.split('?');
  if (pathname !== path) return false;
  const expected = new URLSearchParams(query);
  if (expected.has('role')) {
    const currentRole = searchParams.get('role') || DEFAULT_CENTRAL_COMMITTEE_ROLE;
    return expected.get('role') === currentRole;
  }
  return expected.size === 0;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev };
      for (const group of navGroups) {
        for (const item of group.items) {
          if (item.children && isNavActive(pathname, item)) {
            next[item.name] = true;
          }
        }
      }
      return next;
    });
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const isAdmin = Boolean(
    user && ['super_admin', 'president', 'secretary'].includes(user.role)
  );

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/mpa-logo.png"
            alt="MPA"
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/15"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">MPA Portal</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Admin
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-sidebar-foreground hover:bg-white/10"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <AppIcon icon={mobileMenuOpen ? X : Menu} className="h-5 w-5" />
        </Button>
      </div>

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-svh w-[17.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-0 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border/80 px-5">
          <img
            src="/mpa-logo.png"
            alt="MPA Logo"
            className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-white/15"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">Membership Portal</p>
            <p className="text-[11px] text-sidebar-foreground/55">Management Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isNavActive(pathname, item);
                    const hasChildren = Boolean(item.children?.length);
                    const isOpen = openMenus[item.name] ?? active;

                    if (hasChildren) {
                      return (
                        <li key={item.href}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenus((prev) => ({
                                ...prev,
                                [item.name]: !(prev[item.name] ?? active),
                              }))
                            }
                            className={cn(
                              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                              active
                                ? 'bg-white/10 text-sidebar-foreground'
                                : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'
                            )}
                            aria-expanded={isOpen}
                          >
                            <AppIcon
                              icon={item.icon}
                              className={cn(
                                'h-[18px] w-[18px]',
                                active
                                  ? 'text-sidebar-primary'
                                  : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <AppIcon
                              icon={ChevronDown}
                              className={cn(
                                'h-4 w-4 text-sidebar-foreground/40 transition-transform',
                                isOpen && 'rotate-180'
                              )}
                            />
                          </button>
                          {isOpen && (
                            <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/70 pl-2">
                              {item.children!.map((child) => {
                                const childActive = isChildActive(
                                  pathname,
                                  searchParams,
                                  child.href
                                );
                                return (
                                  <li key={child.href}>
                                    <Link
                                      href={child.href}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className={cn(
                                        'group/child flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] transition-colors',
                                        childActive
                                          ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm'
                                          : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground'
                                      )}
                                    >
                                      <AppIcon
                                        icon={child.icon}
                                        className={cn(
                                          'h-3.5 w-3.5',
                                          childActive
                                            ? 'text-sidebar-primary-foreground'
                                            : 'text-sidebar-foreground/45 group-hover/child:text-sidebar-foreground'
                                        )}
                                      />
                                      <span className="truncate">{child.name}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    }

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                            active
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                              : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'
                          )}
                        >
                          <AppIcon
                            icon={item.icon}
                            className={cn(
                              'h-[18px] w-[18px]',
                              active
                                ? 'text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'
                            )}
                          />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-sidebar-border/80 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border/60 bg-white/[0.03] px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                    {user?.full_name || 'Loading…'}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-foreground/50">
                    {user ? formatRole(user.role) : '…'}
                  </p>
                </div>
                <AppIcon icon={ChevronDown} className="h-4 w-4 text-sidebar-foreground/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-1">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user?.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user?.email || user?.username}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <AppIcon icon={Settings2} className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <AppIcon icon={LogOut} className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

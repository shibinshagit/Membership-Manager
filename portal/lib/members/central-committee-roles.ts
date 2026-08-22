import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Briefcase,
  Building2,
  CircleDollarSign,
  Crown,
  FilePenLine,
  Files,
  FolderOpen,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Network,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wallet,
} from 'lucide-react';

export const CENTRAL_COMMITTEE_ROLES = [
  { value: 'executive', label: 'Executive', icon: Briefcase },
  { value: 'central_committee_group', label: 'Central Committee', icon: UsersRound },
  { value: 'patrions', label: 'Patrions', icon: Award },
  { value: 'central_committee', label: 'Only Central Committee', icon: Landmark },
  { value: 'secretary', label: 'Secretary', icon: FilePenLine },
  { value: 'joint_secretary', label: 'Joint Secretary', icon: Files },
  { value: 'president', label: 'President', icon: Crown },
  { value: 'vice_president', label: 'Vice President', icon: ShieldCheck },
  { value: 'treasurer', label: 'Treasurer', icon: Wallet },
  { value: 'joint_treasurer', label: 'Joint Treasurer', icon: HandCoins },
] as const;

export type CentralCommitteeRoleValue =
  (typeof CENTRAL_COMMITTEE_ROLES)[number]['value'];

export const DEFAULT_CENTRAL_COMMITTEE_ROLE: CentralCommitteeRoleValue =
  'executive';

export function isCentralCommitteeRole(
  value: string | null | undefined
): value is CentralCommitteeRoleValue {
  return CENTRAL_COMMITTEE_ROLES.some((role) => role.value === value);
}

export const DASHBOARD_NAV_ICONS = {
  dashboard: LayoutDashboard,
  members: UsersRound,
  documents: FolderOpen,
  fees: CircleDollarSign,
  accounts: Wallet,
  centralCommittee: Building2,
  committee: Network,
  settings: Settings2,
} as const satisfies Record<string, LucideIcon>;

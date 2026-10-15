import Link from 'next/link';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import { getCurrentUser } from '@/lib/auth';
import {
  getLeadershipRoster,
  type LeadershipPerson,
} from '@/lib/dashboard/overview-stats';
import { cn } from '@/lib/utils';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mpa-display',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mpa-body',
});

const OFFICER_ROW_1 = [
  { key: 'president', label: 'President' },
  { key: 'secretary', label: 'Secretary' },
  { key: 'treasurer', label: 'Treasurer' },
] as const;

const OFFICER_ROW_2 = [
  { key: 'vice_president', label: 'Vice President' },
  { key: 'joint_secretary', label: 'Joint Secretary' },
  { key: 'joint_treasurer', label: 'Joint Treasurer' },
] as const;

function pickByRole(people: LeadershipPerson[], role: string): LeadershipPerson | null {
  return people.find((p) => p.membership_type === role) || null;
}

function OfficerCard({
  label,
  person,
}: {
  label: string;
  person: LeadershipPerson | null;
}) {
  return (
    <div className="flex h-full w-full max-w-[12rem] flex-col items-center text-center">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-white/15 shadow-md ring-1 ring-white/10 sm:h-24 sm:w-24">
        {person?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photo_url}
            alt={person.full_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-700/40 to-slate-800/50 text-xl font-semibold text-white/90 sm:text-2xl">
            {(person?.full_name || label).slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex min-h-[4.25rem] w-full flex-1 flex-col items-center">
        <p className="line-clamp-2 font-[family-name:var(--font-mpa-display)] text-sm font-semibold leading-snug tracking-tight text-white sm:text-[15px]">
          {person?.full_name || '—'}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-100/75">
          {label}
        </p>
        <div className="mt-auto pt-1">
          {person ? (
            <Link
              href={`/dashboard/members/${person.id}`}
              className="text-[11px] text-teal-100/70 underline-offset-2 hover:text-white hover:underline"
            >
              View profile
            </Link>
          ) : (
            <span className="invisible text-[11px]" aria-hidden>
              View profile
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OfficerRow({
  title,
  roles,
  people,
}: {
  title: string;
  roles: ReadonlyArray<{ key: string; label: string }>;
  people: LeadershipPerson[];
}) {
  return (
    <section>
      <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/60">
        {title}
      </p>
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-stretch justify-items-center gap-x-3 gap-y-4 sm:gap-x-8">
        {roles.map((role) => (
          <OfficerCard
            key={role.key}
            label={role.label}
            person={pickByRole(people, role.key)}
          />
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const roster = await getLeadershipRoster();
  const patrons = roster.filter((p) => p.membership_type === 'patrions');

  return (
    <div
      className={cn(
        display.variable,
        body.variable,
        'relative min-h-full font-[family-name:var(--font-mpa-body)]'
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,120,110,0.55),_transparent_55%),linear-gradient(160deg,#0f2f2c_0%,#164640_42%,#1a3a48_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
        aria-hidden
      />

      <div className="relative px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <header className="mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mpa-logo.png"
            alt="Madikai Pravasi Association"
            className="h-14 w-14 rounded-xl object-cover shadow-xl ring-2 ring-white/25 sm:h-16 sm:w-16"
          />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-teal-100/75">
            Membership Portal
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-mpa-display)] text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2.15rem]">
            Madikai Pravasi Association
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-teal-50/80">
            Connecting Madikai natives across the globe — membership, community, and care.
          </p>
          <p className="mt-1 text-xs text-teal-100/55">
            Reg. No: KSR/124/2026 · Madikai, Kasaragod
          </p>
        </header>

        <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-8 pb-10 sm:mt-10 sm:gap-10">
          <OfficerRow title="Office bearers" roles={OFFICER_ROW_1} people={roster} />

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <OfficerRow title="Deputy office bearers" roles={OFFICER_ROW_2} people={roster} />

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <section>
            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/60">
              Patrons
            </p>
            {patrons.length === 0 ? (
              <p className="text-center text-sm text-teal-100/55">No patrons listed yet.</p>
            ) : (
              <div className="mx-auto grid w-full grid-cols-2 items-stretch justify-items-center gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-8">
                {patrons.map((person) => (
                  <OfficerCard key={person.id} label="Patron" person={person} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import { getCurrentUser } from '@/lib/auth';
import {
  getLeadershipRoster,
  getUpcomingBirthdays,
  type LeadershipPerson,
} from '@/lib/dashboard/overview-stats';
import { memberDisplayName } from '@/lib/members/display-name';
import { cn } from '@/lib/utils';

const display = Fraunces({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-mpa-display',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-mpa-body',
});

const GOLD = '#e4c57a';
const GOLD_LINE = 'rgba(198, 161, 90, 0.7)';

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
    <article
      className="relative mt-10 flex h-full flex-col items-center border px-3 pb-5 pt-12 text-center sm:mt-12 sm:px-4 sm:pt-14"
      style={{
        borderColor: GOLD_LINE,
        background: 'linear-gradient(180deg, rgba(12, 36, 34, 0.55), rgba(6, 18, 17, 0.85))',
        boxShadow: 'inset 0 0 28px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] bg-[#102826] sm:h-24 sm:w-24"
        style={{ borderColor: GOLD }}
      >
        {person?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photo_url}
            alt={memberDisplayName(person)}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[#e4c57a]">
            {(person ? memberDisplayName(person) : label).slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <p
        className="line-clamp-2 min-h-[2.6rem] font-[family-name:var(--font-mpa-display)] text-sm font-semibold leading-snug sm:text-base"
        style={{ color: GOLD }}
      >
        {person ? memberDisplayName(person) || '—' : '—'}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white sm:text-[11px]">
        {label}
      </p>
      <div className="mt-auto pt-4">
        {person ? (
          <Link
            href={`/dashboard/members/${person.id}`}
            className="text-[11px] tracking-[0.12em] text-white/90 hover:text-[#e4c57a]"
          >
            VIEW PROFILE →
          </Link>
        ) : (
          <span className="invisible text-[11px]" aria-hidden>
            VIEW PROFILE →
          </span>
        )}
      </div>
    </article>
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
      <h2
        className="mb-2 text-center font-[family-name:var(--font-mpa-display)] text-sm font-semibold uppercase tracking-[0.28em] sm:text-base"
        style={{ color: GOLD }}
      >
        {title}
      </h2>
      <div className="mx-auto grid w-full max-w-4xl grid-cols-3 items-stretch gap-3 sm:gap-6">
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

  const [roster, birthdays] = await Promise.all([
    getLeadershipRoster(),
    getUpcomingBirthdays(0),
  ]);
  const patrons = roster.filter((person) => person.membership_type === 'patrions');

  return (
    <div
      className={cn(
        display.variable,
        body.variable,
        'relative min-h-full font-[family-name:var(--font-mpa-body)] text-white'
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0c2422_0%,#071614_40%,#061211_100%)]"
        aria-hidden
      />

      <div className="relative px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <header className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mpa-logo.png"
            alt="Madikai Pravasi Association"
            className="h-20 w-20 rounded-full border-2 object-cover sm:h-24 sm:w-24"
            style={{ borderColor: GOLD }}
          />
          <h1
            className="mt-6 font-[family-name:var(--font-mpa-display)] text-2xl font-semibold leading-tight sm:text-4xl lg:text-5xl"
            style={{ color: GOLD }}
          >
            Madikai Pravasi Association
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            Connecting Madikai across the globe — membership, community and care.
          </p>
        </header>

        <section
          className="relative mx-auto mt-8 max-w-4xl overflow-hidden border px-4 py-6 text-center sm:px-8 sm:py-8"
          style={{
            borderColor: GOLD,
            background:
              'radial-gradient(ellipse at top, rgba(228,197,122,0.22), transparent 55%), linear-gradient(180deg, rgba(32,58,48,0.95), rgba(8,24,22,0.95))',
            boxShadow: '0 0 0 1px rgba(228,197,122,0.25), 0 18px 50px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
            aria-hidden
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f3e2b0]">
            Today&apos;s birthdays
          </p>
          {birthdays.length === 0 ? (
            <p className="mt-3 text-sm text-white/70">No birthdays today.</p>
          ) : (
            <ul className="mt-6 flex flex-wrap items-start justify-center gap-4 sm:gap-5">
              {birthdays.map((person) => (
                <li key={person.id} className="w-40 sm:w-44">
                  <Link
                    href={`/dashboard/members/${person.id}`}
                    className="group flex h-full flex-col items-center border border-[#e4c57a]/40 bg-black/25 px-3 pb-4 pt-5 transition-colors hover:border-[#e4c57a] hover:bg-black/40"
                  >
                    <span className="rounded-full p-1 shadow-[0_0_24px_rgba(228,197,122,0.45)]" style={{ background: GOLD }}>
                      <span className="block h-20 w-20 overflow-hidden rounded-full bg-[#102826] sm:h-24 sm:w-24">
                        {person.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.photo_url}
                            alt={memberDisplayName(person)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#e4c57a]">
                            {memberDisplayName(person).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-3 line-clamp-2 font-[family-name:var(--font-mpa-display)] text-base font-semibold leading-snug text-[#f6e7bf] group-hover:underline">
                      {memberDisplayName(person) || '—'}
                    </span>
                    <span className="mt-2 rounded-full border border-[#e4c57a]/50 bg-[#e4c57a]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3e2b0]">
                      Happy birthday
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div
          className="mx-auto my-8 h-px max-w-5xl sm:my-10"
          style={{ backgroundColor: GOLD_LINE }}
        />

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 pb-4 sm:gap-14">
          <OfficerRow title="Office bearers" roles={OFFICER_ROW_1} people={roster} />
          <OfficerRow title="Deputy office bearers" roles={OFFICER_ROW_2} people={roster} />

          <section>
            <h2
              className="mb-2 text-center font-[family-name:var(--font-mpa-display)] text-sm font-semibold uppercase tracking-[0.28em] sm:text-base"
              style={{ color: GOLD }}
            >
              Honorary patrons & advisors
            </h2>
            {patrons.length === 0 ? (
              <p className="mx-auto mt-4 max-w-xl text-center text-sm text-white/70">
                No patrons yet. Open a member, choose Edit, and set Member Role to Patron.
              </p>
            ) : (
              <div className="mx-auto grid w-full max-w-4xl grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-6">
                {patrons.map((person) => (
                  <OfficerCard key={person.id} label="Patron" person={person} />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer
          className="mx-auto mt-12 max-w-5xl border-t pt-6 text-center text-xs text-white/70 sm:mt-16"
          style={{ borderColor: GOLD_LINE }}
        >
          <p className="font-[family-name:var(--font-mpa-display)] text-sm" style={{ color: GOLD }}>
            Madikai Pravasi Association
          </p>
          <p className="mt-1">Madikai, Kasaragod</p>
          <p className="mt-1 uppercase tracking-[0.14em]">Reg. No: KSR/124/2026</p>
        </footer>
      </div>
    </div>
  );
}

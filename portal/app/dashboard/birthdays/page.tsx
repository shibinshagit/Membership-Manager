import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getUpcomingBirthdays } from '@/lib/dashboard/overview-stats';
import { memberDisplayName } from '@/lib/members/display-name';
import { normalizeWhatsAppPhone } from '@/lib/members/normalize-phone';
import { Button } from '@/components/ui/button';

function wishUrl(name: string, phone: string | null, whatsapp: string | null) {
  const number = normalizeWhatsAppPhone(whatsapp || phone || '');
  if (!number) return null;
  const message = `Happy Birthday ${name}!\n\nWishing you good health, happiness, and a wonderful year ahead.\n\nMadikai Pravasi Association`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default async function BirthdaysPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const birthdays = await getUpcomingBirthdays(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Today&apos;s birthdays</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a WhatsApp wish from here. The dashboard stays limited to office bearers.
        </p>
      </div>

      {birthdays.length === 0 ? (
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No birthdays today.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {birthdays.map((person) => {
            const name = memberDisplayName(person) || person.full_name;
            const href = wishUrl(name, person.phone, person.whatsapp_number);
            return (
              <li key={person.id} className="rounded-lg border border-border/80 bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-muted">
                    {person.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={person.photo_url} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold">
                        {name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <Link href={`/dashboard/members/${person.id}`} className="text-xs text-muted-foreground hover:underline">
                      View profile
                    </Link>
                  </div>
                </div>
                {href ? (
                  <Button asChild className="mt-4 w-full">
                    <a href={href} target="_blank" rel="noreferrer">
                      Wish on WhatsApp
                    </a>
                  </Button>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">No WhatsApp number on file.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

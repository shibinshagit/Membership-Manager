import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session');

  if (sessionToken) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}

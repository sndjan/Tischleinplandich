import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/meal-planner');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Wochen-Essensplaner
        </h1>
        <p className="text-gray-600 mb-8 text-lg">
          Mahlzeiten planen, Einkaufsliste automatisch
        </p>
        <div className="space-y-4">
          <Link href="/auth/signup">
            <Button className="w-full">Loslegen</Button>
          </Link>
          <Link href="/auth/signin">
            <Button variant="outline" className="w-full">
              Anmelden
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

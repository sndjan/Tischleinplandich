import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing/landing-page';

const title = 'Essensplaner – Wochenplaner fürs Essen mit Einkaufsliste & Kalorien';
const description =
  'Plane dein Essen für die ganze Woche: Rezepte per KI importieren, Kalorien und Protein im Blick, Einkaufsliste automatisch. Web-App für Handy und Computer, ab 4,90 €.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: 'Essensplaner',
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
};

// Signed-in users go straight to their planner; everyone else sees the landing page.
export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/meal-planner');

  return <LandingPage />;
}

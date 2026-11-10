import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingForm from './form';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Déjà une entreprise ? On passe directement au tableau de bord.
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (company) redirect('/dashboard');

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Bienvenue 👋</h1>
      <p className="mt-1 mb-6 text-slate-600">
        2 minutes pour renseigner votre entreprise. Vos devis seront conformes
        et prêts à envoyer.
      </p>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <OnboardingForm defaultEmail={user.email ?? ''} />
    </main>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HOME_SECTIONS, LANDING_SECTIONS, loadSections, type Switches } from '../lib/sections';
import { useToast } from '../state/Toast';

const TEXT = {
  en: {
    title: 'Home page sections', sub: 'Choose which sections people see. The top banner and photo of the landing page always stay.',
    landing: 'Public landing page (before sign-in)', home: 'Home (after sign-in)', save: 'Save', saved: 'Saved',
    names: {
      landing: { tagline: 'Two taglines strip', video: 'Featured video', contest: 'Contest box', media: 'Community photos and videos', groups: 'Groups', about: 'Five things Kezzo is about', modes: 'Solo, group, battle', join: 'Participation', cta: 'Final sign-up call' },
      home: { contest: 'Contest box', statuses: 'Statuses', live: 'Live now', latest: 'Latest posts' },
    },
  },
  fr: {
    title: 'Sections de la page d’accueil', sub: 'Choisissez les sections que les gens voient. La bannière du haut et la photo de la page publique restent toujours.',
    landing: 'Page publique (avant la connexion)', home: 'Accueil (après la connexion)', save: 'Enregistrer', saved: 'Enregistré',
    names: {
      landing: { tagline: 'Bandeau des deux phrases', video: 'Vidéo à la une', contest: 'Encadré du concours', media: 'Photos et vidéos de la communauté', groups: 'Groupes', about: 'Les cinq choses de Kezzo', modes: 'Solo, groupe, battle', join: 'Participation', cta: 'Appel final à s’inscrire' },
      home: { contest: 'Encadré du concours', statuses: 'Statuts', live: 'En direct', latest: 'Dernières publications' },
    },
  },
} as const;

export function HomeSections({ fr }: { fr: boolean }) {
  const w = fr ? TEXT.fr : TEXT.en;
  const { toast } = useToast();
  const [landing, setLanding] = useState<Switches>({});
  const [home, setHome] = useState<Switches>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadSections(true).then((s) => { setLanding(s.landing); setHome(s.home); }); }, []);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_sections', { p_landing: landing, p_home: home });
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    await loadSections(true);
    toast(w.saved);
  };

  const group = (title: string, ids: readonly string[], state: Switches, set: (s: Switches) => void, names: Record<string, string>) => (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {ids.map((id) => (
        <label key={id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state[id] !== false} onChange={(e) => set({ ...state, [id]: e.target.checked })} />
          {names[id]}
        </label>
      ))}
    </fieldset>
  );

  return (
    <section className="card space-y-3 text-zinc-900" aria-label={w.title}>
      <div>
        <h2 className="text-base font-semibold">{w.title}</h2>
        <p className="text-xs text-zinc-500">{w.sub}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {group(w.landing, LANDING_SECTIONS, landing, setLanding, w.names.landing)}
        {group(w.home, HOME_SECTIONS, home, setHome, w.names.home)}
      </div>
      <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" disabled={busy} onClick={() => void save()}>{w.save}</button>
    </section>
  );
}

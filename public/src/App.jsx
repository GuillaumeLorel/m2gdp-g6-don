import { useEffect, useState } from 'react';
import { HandHeart, RefreshCw } from 'lucide-react';
import { API_BASE } from '@/lib/firebase.js';
import { Button } from '@/components/ui/button.jsx';

/**
 * Coquille minimale de la PWA.
 *
 * Volontairement sans identite visuelle : la charte graphique et les maquettes
 * arrivent de l'UX. Ce qui est deja utile ici, c'est la preuve que le front
 * parle bien au backend Cloudflare (CORS compris) : si ce voyant est au vert,
 * la chaine front -> worker est saine.
 */
export default function App() {
  const [etat, setEtat] = useState('chargement');
  const [detail, setDetail] = useState(null);

  async function verifierApi() {
    setEtat('chargement');
    try {
      const reponse = await fetch(`${API_BASE}/api/health`);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      setDetail(await reponse.json());
      setEtat('ok');
    } catch (erreur) {
      setDetail({ erreur: erreur.message });
      setEtat('erreur');
    }
  }

  useEffect(() => {
    verifierApi();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10">
      <header className="flex items-center gap-3">
        <HandHeart className="size-8 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DON</h1>
          <p className="text-sm text-muted-foreground">
            Enchères caritatives — Groupe 6
          </p>
        </div>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Liaison avec le backend</h2>

        <p className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block size-2.5 rounded-full ${
              { chargement: 'bg-muted-foreground', ok: 'bg-green-600', erreur: 'bg-destructive' }[etat]
            }`}
            aria-hidden="true"
          />
          <span>
            {etat === 'chargement' && 'Vérification en cours…'}
            {etat === 'ok' && 'Worker Cloudflare joignable'}
            {etat === 'erreur' && 'Worker injoignable'}
          </span>
        </p>

        {detail && (
          <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={verifierApi}
          disabled={etat === 'chargement'}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Relancer le test
        </Button>
      </section>

      <p className="text-sm text-muted-foreground">
        Coquille PWA installable. Les écrans arrivent avec les maquettes UX.
      </p>
    </main>
  );
}

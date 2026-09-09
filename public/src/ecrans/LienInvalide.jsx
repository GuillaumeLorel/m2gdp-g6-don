import { useEffect, useState } from 'react';
import { LinkIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { emailEnAttente, envoyerLienMagique } from '@/lib/auth.js';

const ATTENTE_SECONDES = 60;

/**
 * Lien expiré ou déjà consommé.
 *
 * Ce n'est pas une panne mais un cas nominal : les liens durent une heure et ne
 * servent qu'une fois. L'écran l'explique et propose de repartir, plutôt que
 * d'afficher un message technique et de laisser l'utilisateur bloqué.
 */
export default function LienInvalide({ expire }) {
  const [email, setEmail] = useState(emailEnAttente() || '');
  const [etat, setEtat] = useState('saisie'); // saisie | envoi | envoye
  const [erreur, setErreur] = useState(null);
  const [attente, setAttente] = useState(0);

  // Temporisation anti-abus : on ne peut pas redemander un lien en rafale.
  useEffect(() => {
    if (attente <= 0) return undefined;
    const t = setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  async function renvoyer(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEtat('envoi');
    try {
      await envoyerLienMagique(email.trim().toLowerCase());
      setEtat('envoye');
      setAttente(ATTENTE_SECONDES);
    } catch (e) {
      setErreur(e.message);
      setEtat('saisie');
    }
  }

  return (
    <section className="space-y-5">
      <LinkIcon className="size-9 text-muted-foreground" aria-hidden="true" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {expire ? 'Ce lien a expiré' : 'Ce lien n’est plus valable'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {expire
            ? 'Les liens de connexion sont valables une heure. Celui-ci est trop ancien.'
            : 'Ce lien a déjà servi, ou il est incomplet. Un lien ne fonctionne qu’une seule fois.'}{' '}
          Demandez-en un nouveau, c’est immédiat.
        </p>
      </div>

      {etat === 'envoye' ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />
            Nouveau lien envoyé à <strong className="text-foreground">{email}</strong>.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={attente > 0}
            onClick={() => setEtat('saisie')}
          >
            {attente > 0 ? `Renvoyer dans ${attente} s` : 'Renvoyer un lien'}
          </Button>
        </div>
      ) : (
        <form onSubmit={renvoyer} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email-renvoi">E-mail</Label>
            <Input
              id="email-renvoi"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="utilisateur@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {erreur && (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={etat === 'envoi' || !email}>
            {etat === 'envoi' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {etat === 'envoi' ? 'Envoi en cours…' : 'Recevoir un nouveau lien'}
          </Button>
        </form>
      )}
    </section>
  );
}

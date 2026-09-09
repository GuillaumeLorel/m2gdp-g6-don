import { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { envoyerLienMagique } from '@/lib/auth.js';
import { statutEmail } from '@/lib/api.js';

/**
 * Ecran 1 du wireframe : « Se connecter avec votre e-mail ».
 *
 * Une seule saisie, pas de mot de passe. On interroge le backend pour savoir si
 * l'adresse a deja un compte : cela ne change rien au lien envoye (Firebase
 * gere les deux cas), mais cela permet d'annoncer honnetement ce qui va se
 * passer — « lien de connexion » ou « lien d'inscription ».
 */
export default function Connexion() {
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState('saisie'); // saisie | envoi | envoye
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEtat('envoi');

    try {
      const existe = await statutEmail(email.trim().toLowerCase());
      await envoyerLienMagique(email.trim().toLowerCase());
      setDejaInscrit(existe);
      setEtat('envoye');
    } catch (e) {
      setErreur(e.message);
      setEtat('saisie');
    }
  }

  if (etat === 'envoye') {
    return (
      <section className="space-y-4">
        <CheckCircle2 className="size-10 text-green-600" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">Consultez vos e-mails</h1>
        <p className="text-muted-foreground">
          {dejaInscrit
            ? 'Un lien de connexion vient d’être envoyé à '
            : 'Un lien pour créer votre compte vient d’être envoyé à '}
          <strong className="text-foreground">{email}</strong>.
        </p>
        <p className="text-sm text-muted-foreground">
          Le lien est valable une heure et ne fonctionne qu’une fois. Pensez à
          regarder vos indésirables.
        </p>
        <Button variant="outline" onClick={() => setEtat('saisie')}>
          Utiliser une autre adresse
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Se connecter avec votre e-mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Pas de mot de passe — nous vous enverrons un lien magique à votre e-mail.
        </p>
      </header>

      <form onSubmit={soumettre} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="utilisateur@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={erreur ? 'erreur-email' : undefined}
            aria-invalid={erreur ? 'true' : undefined}
          />
        </div>

        {erreur && (
          <p id="erreur-email" role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={etat === 'envoi' || !email}>
          {etat === 'envoi' ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Envoi en cours…
            </>
          ) : (
            <>
              <Mail className="size-4" aria-hidden="true" />
              Envoyer le lien magique
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Pas encore inscrit(e) ? Nous créerons un compte pour vous.
        </p>
      </form>
    </section>
  );
}

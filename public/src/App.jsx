import { useEffect, useState } from 'react';
import { HandHeart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import Connexion from '@/ecrans/Connexion.jsx';
import Inscription from '@/ecrans/Inscription.jsx';
import Accueil from '@/ecrans/Accueil.jsx';
import LienInvalide from '@/ecrans/LienInvalide.jsx';
import { chargerProfil } from '@/lib/api.js';
import { estRetourDeLien, finaliserConnexion, surChangementAuth } from '@/lib/auth.js';

/**
 * Aiguillage du POC J2.
 *
 *   pas connecte              -> Connexion (saisie de l'email)
 *   retour de lien magique    -> finalisation, en redemandant l'adresse si
 *                                le lien est ouvert sur un autre appareil
 *   connecte sans profil      -> Inscription
 *   connecte avec profil      -> Accueil
 *
 * Pas de routeur : quatre etats suffisent, et la navigation par onglets
 * viendra avec les maquettes.
 */
export default function App() {
  const [utilisateur, setUtilisateur] = useState(undefined); // undefined = inconnu
  const [profil, setProfil] = useState(undefined);
  const [emailRedemande, setEmailRedemande] = useState(false);
  const [saisieEmail, setSaisieEmail] = useState('');
  const [lienInvalide, setLienInvalide] = useState(null); // { expire: bool }
  const [erreur, setErreur] = useState(null);

  // 1. Retour de lien magique : a traiter avant tout le reste.
  useEffect(() => {
    if (!estRetourDeLien()) return;
    finaliserConnexion().catch((e) => {
      if (e.message === 'EMAIL_MANQUANT') setEmailRedemande(true);
      else if (e.message === 'LIEN_INVALIDE') setLienInvalide({ expire: e.expire });
      else setErreur(e.message);
    });
  }, []);

  // 2. Etat de connexion.
  useEffect(() => surChangementAuth((u) => setUtilisateur(u)), []);

  // 3. Profil, des qu'on sait qui est connecte.
  useEffect(() => {
    if (utilisateur === undefined) return;
    if (utilisateur === null) {
      setProfil(undefined);
      return;
    }
    chargerProfil().then(setProfil).catch((e) => setErreur(e.message));
  }, [utilisateur]);

  async function confirmerEmail(evenement) {
    evenement.preventDefault();
    setErreur(null);
    try {
      await finaliserConnexion(saisieEmail.trim().toLowerCase());
      setEmailRedemande(false);
    } catch (e) {
      if (e.message === 'LIEN_INVALIDE') {
        setEmailRedemande(false);
        setLienInvalide({ expire: e.expire });
      } else {
        setErreur('Ce lien ne correspond pas à cette adresse.');
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <div className="mb-8 flex items-center gap-2">
        <HandHeart className="size-6" aria-hidden="true" />
        <span className="font-semibold tracking-tight">DON</span>
        <span className="text-sm text-muted-foreground">· Dons entre particuliers</span>
      </div>

      <main className="flex-1">
        {erreur && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {erreur}
          </p>
        )}

        {/* Lien perime ou deja consomme : cas nominal, ecran dedie. */}
        {lienInvalide ? (
          <LienInvalide expire={lienInvalide.expire} />
        ) : /* Lien ouvert sur un autre appareil que celui de la demande. */
        emailRedemande ? (
          <form onSubmit={confirmerEmail} className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Confirmez votre e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien a été demandé depuis un autre appareil. Saisissez l’adresse
              utilisée pour terminer la connexion.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmation">E-mail</Label>
              <Input
                id="confirmation" type="email" required autoComplete="email"
                value={saisieEmail} onChange={(e) => setSaisieEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!saisieEmail}>
              Confirmer
            </Button>
          </form>
        ) : utilisateur === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Chargement…
          </p>
        ) : utilisateur === null ? (
          <Connexion />
        ) : profil === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Chargement de votre profil…
          </p>
        ) : profil === null ? (
          <Inscription email={utilisateur.email} surTermine={setProfil} />
        ) : (
          <Accueil profil={profil} />
        )}
      </main>
    </div>
  );
}

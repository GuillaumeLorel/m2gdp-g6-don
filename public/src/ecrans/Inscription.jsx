import { useState } from 'react';
import { Loader2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { enregistrerProfil } from '@/lib/api.js';

/** Aujourd'hui, borne haute du champ : on ne naît pas dans le futur. */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const ROLES = [
  {
    valeur: 'donateur',
    titre: 'Donateur',
    detail: 'Je donne des objets dont je n’ai plus l’usage',
  },
  {
    valeur: 'beneficiaire',
    titre: 'Bénéficiaire',
    detail: 'Je cherche des objets dont j’ai besoin',
  },
];

/**
 * Ecran 3 du wireframe : « Formulaire d'inscription ».
 *
 * L'email n'est pas saisi ici : il est deja prouve par le lien magique, et le
 * Worker le reprend du jeton verifie. Le laisser modifiable ouvrirait la porte
 * a une usurpation d'adresse.
 */
export default function Inscription({ email, surTermine }) {
  const [champs, setChamps] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    roles: [],
    adressePostale: '',
    codePostal: '',
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  const codePostalValide = /^\d{5}$/.test(champs.codePostal);

  const complet =
    champs.nom.trim() &&
    champs.prenom.trim() &&
    champs.dateNaissance &&
    champs.roles.length &&
    champs.adressePostale.trim().length >= 5 &&
    codePostalValide;

  const modifier = (cle) => (e) =>
    setChamps((precedent) => ({ ...precedent, [cle]: e.target.value }));

  const basculerRole = (valeur) => (coche) =>
    setChamps((precedent) => ({
      ...precedent,
      roles: coche
        ? [...precedent.roles, valeur]
        : precedent.roles.filter((r) => r !== valeur),
    }));

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      surTermine(await enregistrerProfil(champs));
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Formulaire d’inscription</h1>
        <p className="text-sm text-muted-foreground">
          Vous êtes identifié(e) comme <strong className="text-foreground">{email}</strong>.
          Complétez votre profil pour terminer.
        </p>
      </header>

      <form onSubmit={soumettre} className="space-y-4" noValidate>
        {/* Emplacement photo : l'envoi de fichier vers R2 viendra plus tard. */}
        <div className="flex justify-center">
          <div
            className="flex size-20 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <UserRound className="size-9 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" required autoComplete="family-name" placeholder="Dupont"
            value={champs.nom} onChange={modifier('nom')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" required autoComplete="given-name" placeholder="Marie"
            value={champs.prenom} onChange={modifier('prenom')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="naissance">Date de naissance</Label>
          <Input
            id="naissance"
            type="date"
            required
            autoComplete="bday"
            max={aujourdhui()}
            value={champs.dateNaissance}
            onChange={modifier('dateNaissance')}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium leading-none">
            Que souhaitez-vous faire ?
          </legend>
          <p className="text-xs text-muted-foreground">
            Les deux sont possibles : on peut donner ce dont on n’a plus l’usage
            et chercher autre chose.
          </p>

          {ROLES.map((role) => (
            <label
              key={role.valeur}
              htmlFor={role.valeur}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-foreground"
            >
              <Checkbox
                id={role.valeur}
                checked={champs.roles.includes(role.valeur)}
                onCheckedChange={basculerRole(role.valeur)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{role.titre}</span>
                <span className="block text-xs text-muted-foreground">
                  {role.detail}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="adresse">Adresse postale</Label>
          <Input id="adresse" required autoComplete="street-address"
            placeholder="12 rue de la République, 69002 Lyon"
            value={champs.adressePostale} onChange={modifier('adressePostale')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codePostal">Code postal</Label>
          <Input
            id="codePostal"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="69002"
            value={champs.codePostal}
            onChange={(e) =>
              setChamps((p) => ({
                ...p,
                codePostal: e.target.value.replace(/\D/g, '').slice(0, 5),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Les objets se récupèrent en main propre : le code postal sert à
            calculer la proximité.
          </p>
        </div>

        {erreur && (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={envoi || !complet}>
          {envoi && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {envoi ? 'Enregistrement…' : 'S’inscrire'}
        </Button>
      </form>
    </section>
  );
}

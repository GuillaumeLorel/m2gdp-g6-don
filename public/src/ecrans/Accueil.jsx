import { useEffect, useState } from 'react';
import { LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { listerUtilisateurs } from '@/lib/api.js';
import { seDeconnecter } from '@/lib/auth.js';

const LIBELLE_ROLE = {
  donateur: 'Donateur',
  beneficiaire: 'Bénéficiaire',
};

/** « Donateur », « Bénéficiaire », ou « Donateur et bénéficiaire ». */
function libelleRoles(roles = []) {
  const noms = roles.map((r) => LIBELLE_ROLE[r] || r);
  if (noms.length === 0) return 'Rôle non précisé';
  if (noms.length === 1) return noms[0];
  return `${noms[0]} et ${noms.slice(1).join(', ').toLowerCase()}`;
}

/**
 * Ecran d'arrivee une fois connecte et inscrit.
 *
 * L'annuaire des inscrits n'est pas du decor : la J2 demande « l'inscription
 * pas a pas ET l'affichage des utilisateurs ». C'est la preuve visible que le
 * profil a bien ete ecrit dans Firestore par le Worker.
 */
export default function Accueil({ profil }) {
  const [utilisateurs, setUtilisateurs] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    listerUtilisateurs().then(setUtilisateurs).catch((e) => setErreur(e.message));
  }, []);

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bonjour {profil.prenom}
          </h1>
          <p className="text-sm text-muted-foreground">
            {libelleRoles(profil.roles)} · {profil.adressePostale}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={seDeconnecter}>
          <LogOut className="size-4" aria-hidden="true" />
          Quitter
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden="true" />
            Inscrits
            {utilisateurs && (
              <span className="font-normal text-muted-foreground">
                ({utilisateurs.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {erreur && (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          )}
          {!erreur && !utilisateurs && (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
          {utilisateurs && utilisateurs.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun inscrit pour le moment.</p>
          )}
          {utilisateurs && utilisateurs.length > 0 && (
            <ul className="divide-y">
              {utilisateurs.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium"
                    aria-hidden="true"
                  >
                    {(u.prenom?.[0] || '?').toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {u.prenom} {u.nom}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {libelleRoles(u.roles)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        POC J2 — inscription et connexion. Les écrans de dons et de demandes
        arrivent avec les maquettes.
      </p>
    </section>
  );
}

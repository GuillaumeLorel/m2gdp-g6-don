import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { ErreurChargement } from "@/components/Etats.jsx";
import CreerAnnonce from "@/ecrans/CreerAnnonce.jsx";
import { chargerEdition } from "@/lib/api.js";

/**
 * Modifier son annonce (US-11, issue #39) : charge la fiche complete — avec
 * l'adresse exacte et les champs figes —, puis reprend l'ecran de creation.
 */
export default function ModifierAnnonce({ profil, surProfil }) {
  const { id } = useParams();
  const [edition, setEdition] = useState(null);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(() => {
    setErreur(null);
    chargerEdition(id)
      .then(setEdition)
      .catch((e) => setErreur(e.message));
  }, [id]);
  useEffect(charger, [charger]);

  if (erreur) return <ErreurChargement message={erreur} surReessayer={charger} />;
  if (!edition) {
    return (
      <p className="flex items-center gap-2.5 pt-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Chargement de l’annonce…
      </p>
    );
  }
  return <CreerAnnonce key={edition.id} profil={profil} surProfil={surProfil} edition={edition} />;
}

import { useEffect, useState } from "react";
import { ContextePosition, positionDeLaVille } from "@/lib/distance.js";

/**
 * Cherche une seule fois le centre de la ville du profil, puis le met a
 * disposition de toutes les cartes d'annonce. Sans reponse du service, aucune
 * distance ne s'affiche : rien n'est bloque.
 */
export default function FournisseurPosition({ profil, children }) {
  const [depuis, setDepuis] = useState(null);
  const { codePostal, ville } = profil;

  useEffect(() => {
    if (!codePostal || !ville) return undefined;
    const controle = new AbortController();
    setDepuis(null);
    positionDeLaVille(codePostal, ville, controle.signal).then((position) => {
      if (!controle.signal.aborted) setDepuis(position);
    });
    return () => controle.abort();
  }, [codePostal, ville]);

  return <ContextePosition.Provider value={depuis}>{children}</ContextePosition.Provider>;
}

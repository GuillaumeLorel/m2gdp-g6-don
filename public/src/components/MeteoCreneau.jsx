import { useEffect, useState } from "react";
import { chargerMeteoCreneau } from "@/lib/meteo.js";

/**
 * Meteo prevue pendant le creneau de retrait, sous la date. Rien ne s'affiche
 * quand il n'y a pas de prevision (creneau passe ou trop lointain, service
 * indisponible) : la fiche ne montre jamais d'erreur pour une information
 * d'appoint.
 */
export default function MeteoCreneau({ annonce }) {
  const [meteo, setMeteo] = useState(null);
  const { latitudeApprochee, longitudeApprochee, creneauRetrait } = annonce;

  useEffect(() => {
    const controle = new AbortController();
    setMeteo(null);
    chargerMeteoCreneau(
      { latitude: latitudeApprochee, longitude: longitudeApprochee, creneau: creneauRetrait },
      controle.signal,
    ).then((resultat) => !controle.signal.aborted && setMeteo(resultat));
    return () => controle.abort();
  }, [latitudeApprochee, longitudeApprochee, creneauRetrait?.debut, creneauRetrait?.fin]);

  if (!meteo) return null;
  return (
    <p className="mt-1.5 flex items-center gap-2.5 text-sm text-ardoise">
      <span aria-hidden="true" className="grid size-5 place-items-center text-base leading-none">
        {meteo.icone}
      </span>
      <span>
        {meteo.libelle} · {meteo.temperatureC} °C · pluie {meteo.probabilitePluie} %
      </span>
    </p>
  );
}

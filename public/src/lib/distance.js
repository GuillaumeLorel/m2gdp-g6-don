import { createContext, useContext } from "react";

/**
 * Distance approximative d'une annonce (US-19, #47). On mesure du centre de la
 * ville de la personne (code postal et ville de son profil, jamais son adresse
 * exacte) jusqu'a la position APPROCHEE de l'annonce, et on arrondit a 0,5 km :
 * une distance plus precise permettrait de retrouver l'adresse exacte.
 */
const SERVICE = "https://data.geopf.fr/geocodage/search";
const RAYON_TERRE_KM = 6371;

/** Contexte : le point de depart de la personne connectee, ou `null`. */
export const ContextePosition = createContext(null);

const radians = (degres) => (degres * Math.PI) / 180;

/** Distance en km entre deux points, arrondie au demi-kilometre. */
export function distanceKm(depuis, vers) {
  const dLat = radians(vers.latitude - depuis.latitude);
  const dLon = radians(vers.longitude - depuis.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(depuis.latitude)) * Math.cos(radians(vers.latitude)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(a));
  return Math.round(km * 2) / 2;
}

/** « À moins de 500 m », « À 1,5 km ». */
export function formaterDistance(km) {
  if (km <= 0.5) return "À moins de 500 m";
  return `À ${km.toLocaleString("fr-FR")} km`;
}

/** Le centre de la commune, ou `null` si le service ne repond pas. Ne leve jamais. */
export async function positionDeLaVille(codePostal, ville, signal) {
  try {
    const url = new URL(SERVICE);
    url.search = new URLSearchParams({
      q: `${codePostal} ${ville}`,
      type: "municipality",
      limit: "1",
    }).toString();
    const reponse = await fetch(url, { signal });
    if (!reponse.ok) return null;
    const { features = [] } = await reponse.json();
    const [longitude, latitude] = features[0]?.geometry?.coordinates || [];
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Distance de la personne connectee a une annonce, formatee, ou `null` : point
 * de depart inconnu ou annonce sans position.
 */
export function useDistance(annonce) {
  const depuis = useContext(ContextePosition);
  if (!depuis) return null;
  if (!Number.isFinite(annonce?.latitudeApprochee) || !Number.isFinite(annonce?.longitudeApprochee)) return null;
  return formaterDistance(
    distanceKm(depuis, { latitude: annonce.latitudeApprochee, longitude: annonce.longitudeApprochee }),
  );
}

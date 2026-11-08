/**
 * Suggestions d'adresses : geocodeur de l'IGN, sans cle, appelable depuis le
 * navigateur. `lat` et `lon` centrent la recherche sur Lyon : sans eux, la
 * premiere suggestion pour « 12 rue de la rep » est a Toulouse.
 */
const SERVICE = "https://data.geopf.fr/geocodage/search";
const LYON = { lat: 45.76, lon: 4.84 };

/**
 * @param {string} texte    ce que la personne a tape
 * @param {AbortSignal} [signal]
 * @returns {Promise<{label: string, numeroRue: string, rue: string, codePostal: string, ville: string, latitude?: number, longitude?: number}[]>}
 */
export async function chercherAdresses(texte, signal) {
  const url = new URL(SERVICE);
  url.search = new URLSearchParams({
    q: texte,
    autocomplete: "1",
    limit: "5",
    lat: String(LYON.lat),
    lon: String(LYON.lon),
  }).toString();

  const reponse = await fetch(url, { signal });
  if (!reponse.ok) throw new Error("Service d'adresses indisponible");
  const { features = [] } = await reponse.json();

  return features
    .map(({ properties: p = {}, geometry }) => ({
      label: p.label,
      numeroRue: p.housenumber || "",
      rue: p.street || p.name || "",
      codePostal: p.postcode || "",
      ville: p.city || "",
      longitude: geometry?.coordinates?.[0],
      latitude: geometry?.coordinates?.[1],
    }))
    .filter((a) => a.label && a.rue && /^\d{5}$/.test(a.codePostal) && a.ville);
}

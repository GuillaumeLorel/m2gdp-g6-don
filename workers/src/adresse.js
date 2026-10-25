/**
 * Adresse a deux niveaux : numero, rue et complement restent prives ; code
 * postal et ville sont publics. Memes regles pour le profil et pour le lieu de
 * retrait d'une annonce. Voir specs/data-model.md, « Adresse a deux niveaux ».
 */

const texte = (v) => (typeof v === 'string' ? v.trim() : '');

/** Erreurs de saisie de l'adresse, vide si tout va bien. */
export function validerAdresse(corps) {
  const erreurs = [];
  if (texte(corps.numeroRue).length < 1) {
    erreurs.push('Le numéro de rue est obligatoire.');
  } else if (texte(corps.numeroRue).length > 10) {
    erreurs.push('Le numéro de rue est trop long (10 max).');
  }

  if (texte(corps.rue).length < 2) {
    erreurs.push('La rue est obligatoire.');
  } else if (texte(corps.rue).length > 150) {
    erreurs.push('Le nom de rue est trop long (150 max).');
  }

  // Facultatif : on ne controle que la longueur s'il est renseigne.
  if (texte(corps.complementAdresse).length > 100) {
    erreurs.push("Le complément d'adresse est trop long (100 max).");
  }

  if (!/^\d{5}$/.test(texte(corps.codePostal))) {
    erreurs.push('Le code postal doit comporter 5 chiffres.');
  }

  if (texte(corps.ville).length < 1) erreurs.push('La ville est obligatoire.');
  if (texte(corps.ville).length > 100) erreurs.push('Le nom de ville est trop long (100 max).');
  return erreurs;
}

/** Les champs d'adresse, nettoyes. A n'appeler qu'apres validerAdresse. */
export const adresseNettoyee = (corps) => ({
  numeroRue: texte(corps.numeroRue),
  rue: texte(corps.rue),
  complementAdresse: texte(corps.complementAdresse),
  codePostal: texte(corps.codePostal),
  ville: texte(corps.ville),
});

/**
 * Geocode l'adresse aupres de la Geoplateforme de l'IGN (data.geopf.fr,
 * service public francais, sans cle). Renvoie { latitude, longitude,
 * quartier }, null si l'adresse est introuvable ; leve une erreur si le
 * service ne repond pas.
 */
export async function geocoder({ numeroRue, rue, codePostal, ville }) {
  const url = new URL('https://data.geopf.fr/geocodage/search');
  url.searchParams.set('q', `${numeroRue} ${rue} ${codePostal} ${ville}`);
  url.searchParams.set('postcode', codePostal);
  url.searchParams.set('limit', '1');
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Geoplateforme ${reponse.status}`);
  const { features = [] } = await reponse.json();
  const f = features[0];
  // La rue suffit si le numero n'est pas repertorie : le point tombe alors au
  // milieu de la rue, ce qui reste juste a l'echelle du quartier.
  if (!f || !['housenumber', 'street'].includes(f.properties.type) || f.properties.score < 0.5) return null;
  const [longitude, latitude] = f.geometry.coordinates;
  return {
    latitude,
    longitude,
    // « Lyon 7e Arrondissement » devient « Lyon 7e » ; hors Lyon, la commune.
    quartier: (f.properties.district || f.properties.city || ville).replace(/ Arrondissement$/, ''),
  };
}

/**
 * Position approchee, publique : la position exacte decalee de 200 a 500 m.
 * Le decalage est DERIVE DE L'ADRESSE, et non tire a chaque annonce : toutes
 * les annonces d'une meme adresse partagent le meme point, et leur moyenne ne
 * retombe pas sur le domicile. Meme calcul que scripts/donnees/generer-donnees-demo.mjs.
 */
export async function positionApprochee(latitude, longitude, adresse) {
  const empreinte = new DataView(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${adresse.numeroRue}|${adresse.rue}|${adresse.codePostal}`.toLowerCase()),
    ),
  );
  const distance = 200 + (empreinte.getUint32(0) / 2 ** 32) * 300;
  const angle = (empreinte.getUint32(4) / 2 ** 32) * 2 * Math.PI;
  const arrondi = (x) => Math.round(x * 1e5) / 1e5;
  return {
    latitudeApprochee: arrondi(latitude + (distance * Math.cos(angle)) / 111320),
    longitudeApprochee: arrondi(
      longitude + (distance * Math.sin(angle)) / (111320 * Math.cos((latitude * Math.PI) / 180)),
    ),
  };
}

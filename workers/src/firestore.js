/**
 * Acces Firestore via l'API REST.
 *
 * Firestore represente chaque valeur par un objet type ({stringValue: "x"}).
 * On isole cette conversion ici pour que le reste du code manipule des objets
 * JavaScript ordinaires.
 */

const RACINE = 'https://firestore.googleapis.com/v1';

/** Objet JS -> representation typee Firestore. */
function versChamps(objet) {
  const champs = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur === null || valeur === undefined) champs[cle] = { nullValue: null };
    else if (typeof valeur === 'string') champs[cle] = { stringValue: valeur };
    else if (typeof valeur === 'boolean') champs[cle] = { booleanValue: valeur };
    else if (typeof valeur === 'number') {
      champs[cle] = Number.isInteger(valeur)
        ? { integerValue: String(valeur) }
        : { doubleValue: valeur };
    } else if (Array.isArray(valeur)) {
      champs[cle] = { arrayValue: { values: valeur.map((v) => versChamps({ v }).v) } };
    } else {
      champs[cle] = { mapValue: { fields: versChamps(valeur) } };
    }
  }
  return champs;
}

/** Representation typee Firestore -> objet JS. */
function depuisChamps(champs = {}) {
  const objet = {};
  for (const [cle, enveloppe] of Object.entries(champs)) {
    const [type, valeur] = Object.entries(enveloppe)[0];
    if (type === 'integerValue') objet[cle] = Number(valeur);
    else if (type === 'doubleValue') objet[cle] = Number(valeur);
    else if (type === 'nullValue') objet[cle] = null;
    else if (type === 'mapValue') objet[cle] = depuisChamps(valeur.fields);
    else if (type === 'arrayValue') {
      objet[cle] = (valeur.values || []).map((v) => depuisChamps({ v }).v);
    } else objet[cle] = valeur;
  }
  return objet;
}

const chemin = (projectId, suite) =>
  `${RACINE}/projects/${projectId}/databases/(default)/documents/${suite}`;

/** Lit un document. Renvoie null s'il n'existe pas. */
export async function lireDocument(jeton, projectId, collection, id) {
  const reponse = await fetch(chemin(projectId, `${collection}/${id}`), {
    headers: { authorization: `Bearer ${jeton}` },
  });
  if (reponse.status === 404) return null;
  if (!reponse.ok) throw new Error(`Firestore ${reponse.status} : ${await reponse.text()}`);
  const doc = await reponse.json();
  return depuisChamps(doc.fields);
}

/** Cree ou remplace un document. */
export async function ecrireDocument(jeton, projectId, collection, id, donnees) {
  const reponse = await fetch(chemin(projectId, `${collection}/${id}`), {
    method: 'PATCH',
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: versChamps(donnees) }),
  });
  if (!reponse.ok) throw new Error(`Firestore ${reponse.status} : ${await reponse.text()}`);
  return depuisChamps((await reponse.json()).fields);
}

/** Liste une collection. `limite` borne la reponse. */
export async function listerCollection(jeton, projectId, collection, limite = 50) {
  const url = new URL(chemin(projectId, collection));
  url.searchParams.set('pageSize', String(limite));

  const reponse = await fetch(url, { headers: { authorization: `Bearer ${jeton}` } });
  if (!reponse.ok) throw new Error(`Firestore ${reponse.status} : ${await reponse.text()}`);

  const { documents = [] } = await reponse.json();
  return documents.map((doc) => ({
    id: doc.name.split('/').pop(),
    ...depuisChamps(doc.fields),
  }));
}

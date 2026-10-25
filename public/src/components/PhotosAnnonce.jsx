import { useId, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { supprimerPhoto, televerserPhoto } from "@/lib/api.js";

export const PHOTOS_MAX = 8;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const TAILLE_MAX = 5 * 1024 * 1024;
// Au-dela, la photo est reduite avant l'envoi : celles d'un telephone
// depassent souvent 5 Mo, et 1600 px suffisent largement a une fiche.
const COTE_MAX = 1600;
const SEUIL_REDUCTION = 1.5 * 1024 * 1024;

/** Reduit une photo trop grande en JPEG ; null si elle ne se decode pas. */
async function reduire(fichier) {
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
    const toile = document.createElement("canvas");
    toile.width = Math.round(image.width * echelle);
    toile.height = Math.round(image.height * echelle);
    toile.getContext("2d").drawImage(image, 0, 0, toile.width, toile.height);
    const blob = await new Promise((ok) => toile.toBlob(ok, "image/jpeg", 0.85));
    return blob && new File([blob], fichier.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/**
 * Photos d'une annonce (US-6) : 8 au plus, d'apres l'ecran 09 de la maquette —
 * une grille de vignettes avec une croix, et une case « + » pour en ajouter.
 *
 * Chaque photo part au serveur des qu'elle est choisie ; le parent ne recoit
 * que les photos arrivees, sous la forme { id, url }, par `surChangement`, un
 * setter d'etat React (il recoit une fonction de mise a jour). Un refus (format,
 * poids) s'affiche sous la grille sans rien perdre de la saisie.
 */
export default function PhotosAnnonce({ photos, surChangement }) {
  const idChamp = useId();
  const entree = useRef(null);
  const [enCours, setEnCours] = useState([]); // apercus locaux pendant l'envoi
  const [erreur, setErreur] = useState(null);

  const places = PHOTOS_MAX - photos.length - enCours.length;

  async function ajouter(evenement) {
    const fichiers = [...evenement.target.files];
    evenement.target.value = ""; // pour pouvoir rechoisir le meme fichier
    setErreur(null);
    if (fichiers.length > places) setErreur(`${PHOTOS_MAX} photos au plus : les suivantes n’ont pas été ajoutées.`);

    await Promise.all(
      fichiers.slice(0, Math.max(places, 0)).map(async (original) => {
        if (!TYPES.includes(original.type)) {
          setErreur(`« ${original.name} » n’a pas été ajoutée : format non pris en charge (JPEG, PNG ou WebP).`);
          return;
        }
        const fichier = original.size > SEUIL_REDUCTION ? await reduire(original) : original;
        if (!fichier || fichier.size > TAILLE_MAX) {
          setErreur(`« ${original.name} » n’a pas été ajoutée : elle est trop lourde (5 Mo au plus).`);
          return;
        }
        const apercu = { cle: crypto.randomUUID(), url: URL.createObjectURL(fichier) };
        setEnCours((liste) => [...liste, apercu]);
        try {
          const media = await televerserPhoto(fichier);
          // Mise a jour fonctionnelle : plusieurs envois se terminent en desordre.
          surChangement((liste) => [...liste, { id: media.id, url: apercu.url }]);
        } catch (e) {
          URL.revokeObjectURL(apercu.url);
          setErreur(`« ${original.name} » n’a pas été ajoutée : ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)}`);
        } finally {
          setEnCours((liste) => liste.filter((a) => a.cle !== apercu.cle));
        }
      }),
    );
  }

  function retirer(photo) {
    surChangement((liste) => liste.filter((p) => p.id !== photo.id));
    supprimerPhoto(photo.id);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={idChamp} className="doneo-etiquette">
        Photos <span className="normal-case tracking-normal">(facultatif, {PHOTOS_MAX} au plus)</span>
      </label>
      <ul className="grid grid-cols-3 gap-3 pt-2 sm:grid-cols-4" aria-label="Photos ajoutées">
        {photos.map((photo, i) => (
          <li key={photo.id} className="relative aspect-square">
            <img src={photo.url} alt={`Photo ${i + 1}`} className="size-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => retirer(photo)}
              aria-label={`Retirer la photo ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ardoise text-white shadow-md">
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {enCours.map((apercu) => (
          <li key={apercu.cle} className="relative aspect-square">
            <img src={apercu.url} alt="" className="size-full rounded-2xl object-cover opacity-50" />
            <Loader2
              className="absolute inset-0 m-auto size-6 animate-spin text-violet-fonce"
              aria-label="Envoi de la photo"
            />
          </li>
        ))}
        {places > 0 && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => entree.current?.click()}
              aria-label="Ajouter des photos"
              className="grid size-full place-items-center rounded-2xl border-[1.5px] border-dashed border-primary/30 bg-white text-violet-fonce transition-colors hover:bg-lavande/40">
              <Plus className="size-6" aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
      <input
        ref={entree}
        id={idChamp}
        type="file"
        accept={TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={ajouter}
      />
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

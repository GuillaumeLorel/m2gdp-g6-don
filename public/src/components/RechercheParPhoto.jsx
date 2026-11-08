import { useId, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { SEUIL_REDUCTION, TAILLE_MAX, reduire } from "@/components/PhotosAnnonce.jsx";
import { rechercherParImage } from "@/lib/api.js";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * « Chercher avec une photo » (#143) : le demandeur photographie un objet au
 * lieu de taper des mots. La photo est decrite par l'IA, puis la recherche
 * existante prend le relais. Rien n'est enregistre. La photo partant chez un
 * tiers, l'envoi est subordonne a un consentement explicite ; si l'analyse
 * echoue, la recherche par mots reste disponible.
 */
export default function RechercheParPhoto({ surResultat, surFermer }) {
  const id = useId();
  const entree = useRef(null);
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function analyser(evenement) {
    const original = evenement.target.files[0];
    evenement.target.value = "";
    if (!original) return;
    setErreur(null);
    if (!TYPES.includes(original.type)) {
      setErreur("Format non pris en charge : JPEG, PNG ou WebP.");
      return;
    }
    setEnvoi(true);
    try {
      const fichier = original.size > SEUIL_REDUCTION ? await reduire(original) : original;
      if (!fichier || fichier.size > TAILLE_MAX) throw new Error("Cette photo est trop lourde (5 Mo au plus).");
      surResultat(await rechercherParImage(fichier));
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="doneo-carte mt-3 space-y-3 p-4" role="group" aria-labelledby={`${id}-titre`}>
      <div className="flex items-center justify-between gap-2">
        <p id={`${id}-titre`} className="doneo-etiquette flex items-center gap-2">
          <Camera className="size-4 text-violet-fonce" aria-hidden="true" />
          Chercher avec une photo
        </p>
        <button
          type="button"
          onClick={surFermer}
          aria-label="Fermer la recherche par photo"
          className="grid size-8 place-items-center rounded-full bg-lavande text-violet-fonce">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm leading-6 text-ardoise">
        Photographiez l’objet que vous cherchez : l’assistant le reconnaît et lance la recherche.
      </p>
      <label htmlFor={`${id}-accord`} className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-ardoise">
        <input
          id={`${id}-accord`}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-primary"
          checked={accord}
          onChange={(e) => setAccord(e.target.checked)}
        />
        <span>
          J’accepte que cette photo soit envoyée à Google (Gemini) pour reconnaître l’objet. Elle peut être traitée hors de
          l’Union européenne et n’est pas conservée par Donéo.
        </span>
      </label>
      <input
        ref={entree}
        type="file"
        accept={TYPES.join(",")}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Photo de l’objet à chercher"
        onChange={analyser}
      />
      <Button type="button" variant="doneo" size="pilule" className="w-full" disabled={!accord || envoi} onClick={() => entree.current?.click()}>
        {envoi ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
        {envoi ? "Analyse de la photo…" : "Prendre ou choisir une photo"}
      </Button>
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

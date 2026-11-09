import { useId, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { reduire } from "@/components/PhotosAnnonce.jsx";
import { televerserPhoto } from "@/lib/api.js";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Photo de profil, a l'inscription et dans « Modifier mon profil ». La photo
 * part au serveur des qu'elle est choisie (reduite avant l'envoi, comme celles
 * des annonces) ; le formulaire n'en garde que l'adresse, enregistree avec le
 * profil. Sans photo, le profil affiche les initiales du membre.
 */
export default function PhotoProfil({ photoUrl, surChangement }) {
  const id = useId();
  const entree = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function choisir(evenement) {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = "";
    if (!fichier) return;
    setErreur(null);
    if (fichier.type && !TYPES.includes(fichier.type)) {
      setErreur("Format non pris en charge : choisissez une photo JPEG, PNG ou WebP.");
      return;
    }
    setEnvoi(true);
    try {
      const reduite = (await reduire(fichier)) || fichier;
      const media = await televerserPhoto(reduite);
      surChangement(media.url);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      <button
        type="button"
        onClick={() => entree.current?.click()}
        disabled={envoi}
        aria-label={photoUrl ? "Changer la photo de profil" : "Ajouter une photo de profil"}
        className="relative rounded-full focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none">
        <span className="grid size-24 place-items-center overflow-hidden rounded-full border-2 border-primary/20 bg-white">
          {photoUrl ? (
            <img src={photoUrl} alt="Votre photo de profil" className="size-full object-cover" />
          ) : (
            <img src="/illustrations/objet-coeur.svg" alt="" aria-hidden="true" className="size-14" />
          )}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border-[2.5px] border-background bg-primary text-white shadow-lg shadow-primary/40">
          {envoi ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        </span>
      </button>
      <input ref={entree} id={id} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={choisir} />
      {photoUrl && !envoi && (
        <button type="button" onClick={() => surChangement("")} className="text-sm font-semibold text-violet-fonce">
          Retirer la photo
        </button>
      )}
      {!photoUrl && !envoi && <p className="text-xs text-muted-foreground">Photo de profil (facultatif)</p>}
      {erreur && (
        <p role="alert" className="text-center text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

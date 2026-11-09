import { useEffect, useRef, useState } from "react";
import { Crop, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";

/** Plus grand cote de l'image envoyee : assez pour reconnaitre un objet, assez peu pour rester legere. */
const COTE_MAX = 1600;
/** Taille minimale du cadre, en part de l'image. */
const MIN = 0.1;

const borner = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * Applique un glissement au cadre. `mode` : « deplacer », ou un coin (nw, ne,
 * sw, se). Le cadre et les deplacements sont en parts de l'image (0 a 1) : il
 * suit l'image si l'ecran change de taille.
 */
function glisser(mode, depart, dx, dy) {
  if (mode === "deplacer") {
    return { ...depart, x: borner(depart.x + dx, 0, 1 - depart.w), y: borner(depart.y + dy, 0, 1 - depart.h) };
  }
  let x1 = depart.x;
  let y1 = depart.y;
  let x2 = depart.x + depart.w;
  let y2 = depart.y + depart.h;
  if (mode.includes("w")) x1 = borner(x1 + dx, 0, x2 - MIN);
  if (mode.includes("e")) x2 = borner(x2 + dx, x1 + MIN, 1);
  if (mode.includes("n")) y1 = borner(y1 + dy, 0, y2 - MIN);
  if (mode.includes("s")) y2 = borner(y2 + dy, y1 + MIN, 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const COINS = [
  { mode: "nw", classes: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize", libelle: "haut gauche" },
  { mode: "ne", classes: "left-full top-0 -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize", libelle: "haut droit" },
  { mode: "sw", classes: "left-0 top-full -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize", libelle: "bas gauche" },
  { mode: "se", classes: "left-full top-full -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize", libelle: "bas droit" },
];

/**
 * Fenetre de recadrage, avant une recherche par image : l'utilisateur
 * entoure l'objet a chercher dans sa photo (comme sur Leboncoin ou Google
 * Lens), et seule cette zone est envoyee. Rien n'est enregistre.
 *
 * Le cadre se deplace en le glissant et se redimensionne par ses coins, a la
 * souris comme au doigt. « Toute la photo » reste le chemin le plus court, et
 * l'alternative au clavier.
 *
 * Renvoie, par `surValider`, un JPEG deja reduit : la reduction des grosses
 * photos de telephone se fait ici.
 */
export default function RecadrageImage({ fichier, surValider, surAnnuler }) {
  const boite = useRef(null);
  const image = useRef(null);
  const [url, setUrl] = useState(null);
  const [taille, setTaille] = useState(null); // taille affichee de l'image, en px
  const [cadre, setCadre] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const geste = useRef(null);

  // L'adresse de l'apercu vit tant que la fenetre est ouverte.
  useEffect(() => {
    const adresse = URL.createObjectURL(fichier);
    setUrl(adresse);
    return () => URL.revokeObjectURL(adresse);
  }, [fichier]);

  useEffect(() => {
    const dialogue = boite.current;
    if (dialogue && !dialogue.open) dialogue.showModal();
  }, []);

  // La taille affichee change avec l'ecran (rotation du telephone).
  useEffect(() => {
    const mesurer = () => {
      const r = image.current?.getBoundingClientRect();
      if (r && r.width > 0) setTaille({ l: r.width, h: r.height });
    };
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  }, []);

  function commencer(mode) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      geste.current = { mode, x: e.clientX, y: e.clientY, depart: cadre };
    };
  }

  function deplacer(e) {
    const g = geste.current;
    if (!g || !taille) return;
    setCadre(glisser(g.mode, g.depart, (e.clientX - g.x) / taille.l, (e.clientY - g.y) / taille.h));
  }

  const finir = () => {
    geste.current = null;
  };

  /** Recadre l'image d'origine, la reduit, et la rend en JPEG. `zone` : { x, y, w, h } en parts de l'image. */
  async function valider(zone) {
    const img = image.current;
    setEnvoi(true);
    setErreur(null);
    try {
      const sx = Math.round(zone.x * img.naturalWidth);
      const sy = Math.round(zone.y * img.naturalHeight);
      const sw = Math.max(1, Math.round(zone.w * img.naturalWidth));
      const sh = Math.max(1, Math.round(zone.h * img.naturalHeight));
      const echelle = Math.min(1, COTE_MAX / Math.max(sw, sh));
      const toile = document.createElement("canvas");
      toile.width = Math.max(1, Math.round(sw * echelle));
      toile.height = Math.max(1, Math.round(sh * echelle));
      toile.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, toile.width, toile.height);
      const blob = await new Promise((ok) => toile.toBlob(ok, "image/jpeg", 0.85));
      if (!blob) throw new Error("L’image n’a pas pu être préparée. Essayez une autre photo.");
      surValider(new File([blob], "selection.jpg", { type: "image/jpeg" }));
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <dialog
      ref={boite}
      aria-labelledby="recadrage-titre"
      onCancel={(e) => {
        e.preventDefault();
        if (!envoi) surAnnuler();
      }}
      className="m-auto w-[min(calc(100vw-1.5rem),34rem)] rounded-3xl border-0 bg-white p-4 text-ardoise shadow-2xl backdrop:bg-ardoise/60">
      <div className="space-y-3">
        <p id="recadrage-titre" className="doneo-etiquette flex items-center gap-2">
          <Crop className="size-4 text-violet-fonce" aria-hidden="true" />
          Choisir la zone à chercher
        </p>
        <p className="text-sm leading-6">
          Déplacez le cadre, ou tirez sur ses coins, pour entourer l’objet à chercher. Seule cette zone est envoyée.
        </p>

        <div className="flex justify-center rounded-2xl bg-lilas p-2">
          <div className="relative inline-block touch-none select-none overflow-hidden rounded-xl">
            {url && (
              <img
                ref={image}
                src={url}
                alt="Votre photo, à recadrer"
                draggable={false}
                onLoad={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setTaille({ l: r.width, h: r.height });
                }}
                className="block max-h-[55vh] max-w-full"
              />
            )}
            {taille && (
              <div
                role="group"
                aria-label="Zone sélectionnée"
                data-testid="cadre-recadrage"
                onPointerDown={commencer("deplacer")}
                onPointerMove={deplacer}
                onPointerUp={finir}
                onPointerCancel={finir}
                style={{
                  left: `${cadre.x * 100}%`,
                  top: `${cadre.y * 100}%`,
                  width: `${cadre.w * 100}%`,
                  height: `${cadre.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgb(47 79 92 / 55%)",
                }}
                className="absolute cursor-move border-2 border-white">
                {COINS.map((c) => (
                  <span
                    key={c.mode}
                    role="presentation"
                    data-coin={c.mode}
                    onPointerDown={commencer(c.mode)}
                    onPointerMove={deplacer}
                    onPointerUp={finir}
                    onPointerCancel={finir}
                    className={`absolute grid size-11 place-items-center ${c.classes}`}>
                    <span className="size-4 rounded-full border-2 border-white bg-primary shadow" />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {erreur && (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        <div className="space-y-2">
          <Button type="button" variant="doneo" size="pilule" className="w-full" disabled={envoi || !taille} onClick={() => valider(cadre)}>
            {envoi ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Crop className="size-5" aria-hidden="true" />}
            {envoi ? "Préparation…" : "Chercher sur la sélection"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="doneoSecondaire"
              size="pilule"
              className="flex-1"
              disabled={envoi || !taille}
              onClick={() => valider({ x: 0, y: 0, w: 1, h: 1 })}>
              Toute la photo
            </Button>
            <Button type="button" variant="doneoSecondaire" size="pilule" disabled={envoi} onClick={surAnnuler}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

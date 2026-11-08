import { useContext, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import ChampAdresse from "@/components/ChampAdresse.jsx";
import { ContextePosition } from "@/lib/distance.js";
import { LIBELLES_ETAT } from "@/lib/format.js";

/** Puce selectionnable de la feuille, d'apres l'ecran 07 de la maquette. */
function Puce({ active, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`h-10 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
        active ? "bg-primary text-white shadow-md shadow-primary/30" : "border border-primary/10 bg-white text-ardoise"
      }`}
      {...props}>
      {children}
    </button>
  );
}

export const FILTRES_VIDES = {
  categorieId: "", sousCategorieId: "", etat: "", participationMax: "",
  // « Autour de » (#48) : un point et un rayon. `lieu` n'est que le libelle affiche.
  latitude: "", longitude: "", rayonKm: "", lieu: "",
};

export const RAYONS_KM = [1, 2, 5, 10, 20];
const RAYON_PAR_DEFAUT = 5;

/** Position arrondie a deux decimales (environ 1 km) : on cherche autour d'une zone, pas d'une porte. */
const arrondir = (n) => Math.round(n * 100) / 100;

/** Participation maximale saisie : vide, ou un montant positif (virgule acceptee). */
export function lireMontant(saisie) {
  const texte = String(saisie ?? "").trim().replace(",", ".");
  if (texte === "") return { valeur: null };
  const n = Number(texte);
  if (!Number.isFinite(n) || n < 0 || !/^\d+(\.\d{1,2})?$/.test(texte)) {
    return { erreur: "Saisissez un montant positif, par exemple 3 ou 2,50." };
  }
  return { valeur: n };
}

/**
 * Feuille « Filtres » (US-14, issue #42) : categorie, sous-categorie, etat et
 * participation maximale. Les choix ne s'appliquent qu'a « Appliquer » ; les
 * boutons restent visibles en bas de la feuille, meme sur un petit ecran.
 *
 * « Autour de » (#48) : sa ville, ou une autre adresse, et un rayon. Pas de
 * filtre d'association : l'API ne le prevoit pas. L'etat « A reparer » de la maquette n'existe
 * pas non plus : on s'en tient aux quatre valeurs de l'API.
 */
export default function FeuilleFiltres({ ouverte, categories, filtres, surAppliquer, surFermer }) {
  const titreId = useId();
  const aideId = useId();
  const [brouillon, setBrouillon] = useState(filtres);
  const [montant, setMontant] = useState("");
  const maPosition = useContext(ContextePosition);
  const premierBouton = useRef(null);

  // A chaque ouverture, on repart des filtres en vigueur.
  useEffect(() => {
    if (!ouverte) return undefined;
    setBrouillon(filtres);
    setMontant(filtres.participationMax ? String(filtres.participationMax).replace(".", ",") : "");
    premierBouton.current?.focus();
    const echap = (e) => e.key === "Escape" && surFermer();
    document.addEventListener("keydown", echap);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", echap);
      document.body.style.overflow = "";
    };
  }, [ouverte, filtres, surFermer]);

  if (!ouverte) return null;

  const lu = lireMontant(montant);
  const categorie = categories.find((c) => c.id === brouillon.categorieId);
  const basculer = (cle, valeur) =>
    setBrouillon((b) => ({
      ...b,
      [cle]: b[cle] === valeur ? "" : valeur,
      // Changer de categorie invalide la sous-categorie choisie.
      ...(cle === "categorieId" ? { sousCategorieId: "" } : {}),
    }));

  /** Chercher autour d'un point : le rayon par defaut s'applique des le choix. */
  const centrerSur = (position, lieu) =>
    setBrouillon((b) => ({
      ...b,
      latitude: arrondir(position.latitude),
      longitude: arrondir(position.longitude),
      lieu,
      rayonKm: b.rayonKm || RAYON_PAR_DEFAUT,
    }));
  const retirerCentre = () => setBrouillon((b) => ({ ...b, latitude: "", longitude: "", lieu: "", rayonKm: "" }));

  function appliquer(e) {
    e.preventDefault();
    if (lu.erreur) return;
    surAppliquer({ ...brouillon, participationMax: lu.valeur ?? "" });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-8">
      <button
        type="button"
        aria-label="Fermer les filtres"
        tabIndex={-1}
        onClick={surFermer}
        className="absolute inset-0 bg-ardoise/45"
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        onSubmit={appliquer}
        className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-4xl md:max-w-2xl bg-lilas shadow-2xl lg:max-w-xl lg:rounded-4xl">
        <div className="overflow-y-auto px-5 pt-3 pb-4">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-lavande-soutenue/70 lg:hidden" aria-hidden="true" />
          <div className="mt-3 flex items-center justify-between">
            <h2 id={titreId} className="doneo-titre text-[1.75rem]">
              Filtres
            </h2>
            <button
              ref={premierBouton}
              type="button"
              onClick={surFermer}
              aria-label="Fermer"
              className="grid size-11 place-items-center rounded-2xl border border-primary/10 bg-white text-ardoise">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="doneo-etiquette">Catégorie</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Puce key={c.id} active={brouillon.categorieId === c.id} onClick={() => basculer("categorieId", c.id)}>
                  {c.libelle}
                </Puce>
              ))}
            </div>
          </fieldset>

          {categorie && (
            <fieldset className="mt-5">
              <legend className="doneo-etiquette">Sous-catégorie · {categorie.libelle}</legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {categorie.sousCategories.map((s) => (
                  <Puce
                    key={s.id}
                    active={brouillon.sousCategorieId === s.id}
                    onClick={() => basculer("sousCategorieId", s.id)}>
                    {s.libelle}
                  </Puce>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-5">
            <legend className="doneo-etiquette">État</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {Object.entries(LIBELLES_ETAT).map(([valeur, libelle]) => (
                <Puce key={valeur} active={brouillon.etat === valeur} onClick={() => basculer("etat", valeur)}>
                  {libelle}
                </Puce>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="doneo-etiquette">Autour de</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Puce
                active={brouillon.lieu === "Ma ville"}
                disabled={!maPosition}
                onClick={() => (brouillon.lieu === "Ma ville" ? retirerCentre() : centrerSur(maPosition, "Ma ville"))}>
                Ma ville
              </Puce>
              {brouillon.lieu && brouillon.lieu !== "Ma ville" && (
                <Puce active onClick={retirerCentre} aria-label={`Retirer : autour de ${brouillon.lieu}`}>
                  {brouillon.lieu}
                </Puce>
              )}
            </div>
            <div className="mt-3">
              <ChampAdresse
                id={`${titreId}-autour`}
                etiquette="Une autre adresse"
                surChoix={(adresse, position) =>
                  Number.isFinite(position?.latitude) && centrerSur(position, `${adresse.codePostal} ${adresse.ville}`)
                }
              />
            </div>
            {brouillon.lieu && (
              <div className="mt-3" role="group" aria-label="Rayon de recherche">
                <p className="doneo-etiquette">Rayon</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {RAYONS_KM.map((km) => (
                    <Puce
                      key={km}
                      active={Number(brouillon.rayonKm) === km}
                      onClick={() => setBrouillon((b) => ({ ...b, rayonKm: km }))}>
                      {km} km
                    </Puce>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          <div className="mt-5">
            <label htmlFor={`${titreId}-max`} className="doneo-etiquette">
              Participation maximale
            </label>
            <div className="relative mt-2.5">
              <input
                id={`${titreId}-max`}
                inputMode="decimal"
                placeholder="Sans limite"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                aria-invalid={lu.erreur ? "true" : undefined}
                aria-describedby={lu.erreur ? aideId : undefined}
                className="h-14 w-full rounded-[1.25rem] border-[1.5px] border-primary/20 bg-white px-4.5 pr-10 text-base text-ardoise outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 aria-invalid:border-destructive"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
                €
              </span>
            </div>
            {lu.erreur && (
              <p id={aideId} role="alert" className="mt-1.5 text-sm text-destructive">
                {lu.erreur}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-primary/10 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="doneoSecondaire"
            size="pilule"
            className="flex-1"
            onClick={() => surAppliquer(FILTRES_VIDES)}>
            Réinitialiser
          </Button>
          <Button type="submit" variant="doneo" size="pilule" className="flex-1" disabled={Boolean(lu.erreur)}>
            Appliquer
          </Button>
        </div>
      </form>
    </div>
  );
}

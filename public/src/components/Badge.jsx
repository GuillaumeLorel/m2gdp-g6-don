import { cn } from "@/lib/utils.js";

/**
 * Badge unique de l'application (#132). Trois familles, distinctes par la
 * forme autant que par la couleur (le statut reste lisible sans la couleur) :
 *  - famille="etat"        : état de l'objet, carré, à contour, sans couleur ;
 *  - famille="annonce"     : statut d'une annonce, pastille avec un point ;
 *  - famille="reservation" : statut d'une réservation, pastille pleine ;
 *    le ton « action » (« À payer ») est violet foncé, texte blanc gras.
 * Tous les textes ont un contraste d'au moins 4,5:1.
 */
// max-w-full : un badge ne deborde jamais de sa carte, meme sur un ecran de 320 px.
const BASE = "inline-flex max-w-full shrink-0 items-center gap-1 text-[0.6875rem] leading-4 px-2 py-0.5";

const FAMILLES = {
  etat: "rounded-[0.375rem] border border-ardoise/30 bg-white font-semibold text-ardoise",
  annonce: "rounded-full font-semibold text-ardoise",
  reservation: "rounded-full font-semibold text-ardoise",
};

const TONS = {
  // Annonce : un point de couleur, jamais une pastille pleine.
  disponible: ["bg-menthe", "bg-succes"],
  reserve: ["bg-citron", "bg-alerte"],
  remis: ["bg-lavande", "bg-violet-fonce"],
  passe: ["border border-destructive bg-white text-destructive", "bg-destructive"],
  // Réservation : l'action attendue ressort, les autres sont discrètes.
  action: ["bg-violet-fonce font-bold text-white"],
  attente: ["bg-pervenche"],
  confirmee: ["bg-menthe"],
  remise: ["bg-lavande"],
  annulee: ["bg-muted"],
};

export default function Badge({ famille, ton, children, className }) {
  const [couleur, point] = TONS[ton] || [];
  return (
    <span className={cn(BASE, FAMILLES[famille], famille !== "etat" && couleur, className)}>
      {famille === "annonce" && point && <span aria-hidden="true" className={cn("size-1.5 rounded-full", point)} />}
      {children}
    </span>
  );
}

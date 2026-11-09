import { creneauPasse } from "@/lib/format.js";

/**
 * Libellés et tons de tous les badges (#132) : un statut a le même aspect
 * partout (accueil, messages, profil, cartes). Trois familles, qui se
 * distinguent par leur forme (voir components/Badge.jsx) :
 *  - l'état de l'objet (« Très bon état ») : neutre, à contour ;
 *  - le statut d'une annonce (« Disponible ») : pastille avec un point ;
 *  - le statut d'une réservation (« À payer ») : pastille pleine, et la
 *    pastille « action » ressort quand c'est à moi d'agir.
 */

/** Statut d'une réservation : { libelle, ton }, ou null s'il n'y a rien à montrer. */
export function badgeReservation(statut, role = "demandeur") {
  const offrant = role === "offrant";
  switch (statut) {
    case "demandee":
      return offrant
        ? { libelle: "Demande à valider", ton: "action" }
        : { libelle: "Demande envoyée", ton: "attente" };
    case "liste_attente":
      return { libelle: "Liste d’attente", ton: "attente" };
    case "proposee":
      return offrant
        ? { libelle: "En attente de paiement", ton: "attente" }
        : { libelle: "À payer", ton: "action" };
    case "confirmee":
      return { libelle: "Confirmée", ton: "confirmee" };
    case "remise":
      return { libelle: "Remise", ton: "remise" };
    case "annulee":
      return { libelle: "Annulée", ton: "annulee" };
    default:
      return null;
  }
}

/** Statut d'une annonce (l'objet) : { libelle, ton }. */
export function badgeAnnonce(annonce) {
  if (annonce.statut === "remis") return { libelle: "Remis", ton: "remis" };
  if (creneauPasse(annonce.creneauRetrait)) return { libelle: "Créneau passé", ton: "passe" };
  if (annonce.statut === "reserve") return { libelle: "Réservé", ton: "reserve" };
  return { libelle: "Disponible", ton: "disponible" };
}

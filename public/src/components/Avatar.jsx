import { cn } from "@/lib/utils.js";

/**
 * Pastille d'un membre : sa photo de profil s'il en a une, sinon ses initiales
 * (« BL »). `membre` porte prenom et nom, ou prenom et initialeNom (forme
 * publique d'un profil).
 */
export default function Avatar({ membre, className }) {
  const initiales = `${membre?.prenom?.[0] || ""}${(membre?.nom || membre?.initialeNom || "")[0] || ""}`.toUpperCase();
  return membre?.photoUrl ? (
    <img src={membre.photoUrl} alt="" aria-hidden="true" className={cn("shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full bg-lavande font-titre font-semibold text-violet-fonce", className)}>
      {initiales || "?"}
    </span>
  );
}

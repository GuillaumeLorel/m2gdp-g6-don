import { NavLink } from "react-router";
import { Home, MessageCircle, Plus, Search, User } from "lucide-react";

const ONGLETS = [
  { vers: "/", libelle: "Accueil", Icone: Home, exact: true },
  { vers: "/recherche", libelle: "Recherche", Icone: Search },
  { vers: "/creer", libelle: "Créer", Icone: Plus, central: true },
  { vers: "/messages", libelle: "Messages", Icone: MessageCircle },
  { vers: "/profil", libelle: "Profil", Icone: User },
];

/**
 * Menu du bas, partage par tous les ecrans connectes. Fixe : il reste visible
 * quand la page defile. L'onglet actif est en violet, icone pleine et point
 * dessous, comme sur la maquette ; « Creer » est le bouton rond central.
 */
export default function MenuBas() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-(--hauteur-menu) lg:hidden max-w-md md:max-w-3xl items-start justify-around rounded-t-[1.75rem] border-t border-primary/10 bg-white px-3 pt-2.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-14px_rgb(155_77_219/30%)]">
      {ONGLETS.map(({ vers, libelle, Icone, exact, central }) => (
        <NavLink
          key={vers}
          to={vers}
          end={exact}
          className="flex flex-1 flex-col items-center gap-1 text-[0.6875rem] font-medium">
          {({ isActive }) =>
            central ? (
              <>
                <span className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95">
                  <Icone className="size-6" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className={isActive ? "text-violet-fonce" : "text-muted-foreground"}>
                  {libelle}
                </span>
              </>
            ) : (
              <>
                <Icone
                  className={`size-5.5 ${isActive ? "text-primary" : "text-ardoise"}`}
                  fill={isActive ? "currentColor" : "none"}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span
                  aria-hidden="true"
                  className={`size-1 rounded-full ${isActive ? "bg-primary" : "bg-transparent"}`}
                />
                <span className={isActive ? "text-violet-fonce" : "text-muted-foreground"}>
                  {libelle}
                </span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  );
}

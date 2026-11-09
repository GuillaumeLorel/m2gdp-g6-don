import { Link, NavLink } from "react-router";
import { Heart, Home, MessageCircle, Plus, Search } from "lucide-react";
import { Marque } from "@/components/Logo.jsx";
import Avatar from "@/components/Avatar.jsx";
import PastilleNonLus from "@/components/PastilleNonLus.jsx";
import { libelleMessages, useNonLus } from "@/lib/nonLus.js";

const LIENS = [
  { vers: "/", libelle: "Accueil", Icone: Home, exact: true },
  { vers: "/recherche", libelle: "Recherche", Icone: Search },
  { vers: "/messages", libelle: "Messages", Icone: MessageCircle },
  { vers: "/favoris", libelle: "Favoris", Icone: Heart },
];

/**
 * Barre de navigation du grand ecran, a la place du menu du bas : sur un
 * ordinateur, on cherche la navigation en haut. Memes destinations que le
 * menu mobile, avec « Creer une annonce » en bouton d'appel et le profil en
 * pastille de sa photo, ou de ses initiales.
 */
export default function EnTeteBureau({ profil }) {
  const nonLus = useNonLus();

  return (
    <header className="sticky top-0 z-30 hidden border-b border-primary/10 bg-white lg:block">
      <div className="mx-auto flex h-18 max-w-6xl items-center gap-8 px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Donéo — accueil">
          <Marque className="size-9" />
          <span className="font-titre text-xl font-semibold tracking-[0.03em] text-primary" aria-hidden="true">
            DONÉO
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="flex items-center gap-1">
          {LIENS.map(({ vers, libelle, Icone, exact }) => (
            <NavLink
              key={vers}
              to={vers}
              end={exact}
              aria-label={vers === "/messages" ? libelleMessages(nonLus) : undefined}
              className={({ isActive }) =>
                `flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  isActive ? "bg-lavande text-violet-fonce" : "text-ardoise hover:bg-lilas"
                }`
              }>
              <span className="relative">
                <Icone className="size-4.5" aria-hidden="true" />
                {vers === "/messages" && <PastilleNonLus nombre={nonLus} className="absolute -top-2 -right-2.5" />}
              </span>
              {libelle}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/creer"
            className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-titre font-semibold text-white shadow-md shadow-primary/30 transition-colors hover:bg-violet-fonce">
            <Plus className="size-5" aria-hidden="true" />
            Créer une annonce
          </Link>
          <NavLink
            to="/profil"
            aria-label="Profil"
            className={({ isActive }) =>
              `rounded-full transition-shadow ${isActive ? "ring-4 ring-primary/40" : "hover:ring-4 hover:ring-lavande/60"}`
            }>
            <Avatar membre={profil} className="size-11" />
          </NavLink>
        </div>
      </div>
    </header>
  );
}

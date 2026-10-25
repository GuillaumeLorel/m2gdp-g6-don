import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo.jsx";
import EnTeteBureau from "@/components/EnTeteBureau.jsx";
import MenuBas from "@/components/MenuBas.jsx";
import PanneauMarque from "@/components/PanneauMarque.jsx";
import Connexion from "@/ecrans/Connexion.jsx";
import CreerAnnonce from "@/ecrans/CreerAnnonce.jsx";
import Inscription from "@/ecrans/Inscription.jsx";
import Accueil from "@/ecrans/Accueil.jsx";
import Annuaire from "@/ecrans/Annuaire.jsx";
import Bientot from "@/ecrans/Bientot.jsx";
import FicheAnnonce from "@/ecrans/FicheAnnonce.jsx";
import LienInvalide from "@/ecrans/LienInvalide.jsx";
import Profil from "@/ecrans/Profil.jsx";
import Recherche from "@/ecrans/Recherche.jsx";
import { chargerProfil } from "@/lib/api.js";
import {
  estRetourDeLien,
  finaliserConnexion,
  surChangementAuth,
} from "@/lib/auth.js";

/**
 * Coque des ecrans connectes : colonne mobile centree, menu du bas fixe.
 * La marge basse laisse le dernier element visible au-dessus du menu.
 */
function CoqueConnectee({ profil }) {
  return (
    <div className="doneo-coque">
      <EnTeteBureau profil={profil} />
      {/* Mobile : colonne etroite, menu du bas. Grand ecran : largeur d'un
          site, barre de navigation en haut. */}
      <main className="mx-auto min-h-dvh max-w-md px-5 pt-5 md:max-w-3xl pb-[calc(var(--hauteur-menu)+2rem)] lg:min-h-[calc(100dvh-var(--hauteur-entete))] lg:max-w-6xl lg:px-8 lg:pt-8 lg:pb-16">
        <Outlet />
      </main>
      <MenuBas />
    </div>
  );
}

/**
 * Coque des ecrans plein cadre (fiche d'annonce) : pas de marge, pas de menu
 * du bas — l'ecran porte sa propre barre d'action, comme sur la maquette.
 */
function CoquePleinCadre({ profil }) {
  return (
    <div className="doneo-coque">
      <EnTeteBureau profil={profil} />
      <main className="mx-auto min-h-dvh max-w-md md:max-w-3xl lg:max-w-6xl lg:px-8 lg:pt-8 lg:pb-16">
        <Outlet />
      </main>
    </div>
  );
}

function Chargement({ children }) {
  return (
    <p className="flex items-center gap-2.5 pt-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * Aiguillage du POC J2.
 *
 *   pas connecte              -> Connexion (saisie de l'email)
 *   retour de lien magique    -> finalisation (ou ecran « lien invalide »)
 *   connecte sans profil      -> Inscription
 *   connecte avec profil      -> ecrans de l'app, sous le routeur
 *
 * Tant que la personne n'est pas connectee avec un profil complet, l'URL ne
 * compte pas : un visiteur qui ouvre /recherche voit l'ecran de connexion.
 */
export default function App() {
  const [utilisateur, setUtilisateur] = useState(undefined); // undefined = inconnu
  const [profil, setProfil] = useState(undefined);
  const [lienInvalide, setLienInvalide] = useState(null); // { expire: bool }
  const [erreur, setErreur] = useState(null);

  // En developpement, StrictMode monte le composant deux fois : le retour de
  // lien ne doit etre traite qu'une seule fois.
  const lienTraite = useRef(false);

  // 1. Retour de lien magique : a traiter avant tout le reste.
  useEffect(() => {
    if (lienTraite.current || !estRetourDeLien()) return;
    lienTraite.current = true;
    finaliserConnexion().catch((e) => {
      if (e.message === "LIEN_INVALIDE")
        setLienInvalide({ expire: e.expire });
      else setErreur(e.message);
    });
  }, []);

  // 2. Etat de connexion.
  // Le rafraichissement du jeton renvoie un nouvel objet pour la meme
  // personne : on ne change d'utilisateur (et ne recharge le profil) que si
  // l'identifiant change.
  useEffect(
    () => surChangementAuth((u) => setUtilisateur((avant) => (avant && u && avant.id === u.id ? avant : u))),
    [],
  );

  // 3. Profil, des qu'on sait qui est connecte.
  useEffect(() => {
    if (utilisateur === undefined) return;
    if (utilisateur === null) {
      setProfil(undefined);
      return;
    }
    chargerProfil()
      .then(setProfil)
      .catch((e) => setErreur(e.message));
  }, [utilisateur]);

  // La connexion et l'accueil portent deja le logo dans leur propre mise en
  // page : leur ajouter l'en-tete de la coque le ferait apparaitre deux fois.
  let avecEnTete = true;
  let ecran;

  if (lienInvalide) {
    ecran = <LienInvalide expire={lienInvalide.expire} />;
  } else if (utilisateur === undefined) {
    ecran = <Chargement>Chargement…</Chargement>;
  } else if (utilisateur === null) {
    ecran = <Connexion />;
    avecEnTete = false;
  } else if (profil === undefined) {
    ecran = <Chargement>Chargement de votre profil…</Chargement>;
  } else if (profil === null) {
    ecran = <Inscription email={utilisateur.email} surTermine={setProfil} />;
  } else {
    return (
      <Routes>
        <Route element={<CoqueConnectee profil={profil} />}>
          <Route index element={<Accueil profil={profil} />} />
          <Route path="recherche" element={<Recherche />} />
          <Route path="creer" element={<CreerAnnonce profil={profil} surProfil={setProfil} />} />
          <Route
            path="favoris"
            element={
              <Bientot titre="Favoris" illustration="/illustrations/objet-coeur.svg">
                Vous pourrez bientôt garder de côté les objets qui vous plaisent.
              </Bientot>
            }
          />
          <Route path="profil" element={<Profil profil={profil} />} />
          <Route path="membres" element={<Annuaire profil={profil} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        <Route element={<CoquePleinCadre profil={profil} />}>
          <Route path="annonces/:id" element={<FicheAnnonce profil={profil} />} />
        </Route>
      </Routes>
    );
  }

  // Grand ecran : panneau de la marque a gauche, formulaire a droite. Sur
  // mobile, le formulaire seul, comme sur les maquettes.
  return (
    <div className="doneo-coque lg:grid lg:min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <PanneauMarque />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-6 sm:px-8 lg:justify-center lg:py-12">
        {avecEnTete && (
          <div className="mb-8">
            <Logo />
          </div>
        )}

        <main className="flex flex-1 flex-col lg:flex-none">
          {erreur && (
            <p
              role="alert"
              className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              {erreur}
            </p>
          )}
          {ecran}
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

/**
 * En-tete qui reste en haut de l'ecran quand la page defile : la recherche et
 * les filtres restent a portee de pouce. Il deborde sur les marges de la
 * coque pour couvrir toute la largeur, et une ombre legere apparait des
 * qu'il passe au-dessus du contenu.
 */
export default function EnTeteCollant({ children, className = "" }) {
  const [decolle, setDecolle] = useState(false);

  useEffect(() => {
    const suivre = () => setDecolle(window.scrollY > 4);
    suivre();
    window.addEventListener("scroll", suivre, { passive: true });
    return () => window.removeEventListener("scroll", suivre);
  }, []);

  return (
    // Grand ecran : en-tete ordinaire. La barre de navigation du haut reste
    // deja a l'ecran, et la place ne manque pas.
    <div
      // Fond opaque : sur Safari (iPhone), le flou d'arriere-plan ne masque pas
      // toujours le contenu, qui se lisait a travers la recherche et les filtres.
      className={`sticky top-0 z-20 -mx-5 -mt-5 bg-lilas px-5 pt-5 pb-3 transition-shadow lg:static lg:m-0 lg:bg-transparent lg:p-0 lg:pb-4 lg:shadow-none ${
        decolle ? "shadow-[0_10px_24px_-18px_rgb(47_79_92/45%)]" : ""
      } ${className}`}>
      {children}
    </div>
  );
}

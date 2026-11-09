/**
 * Pastille du nombre de conversations non lues, posee en haut a droite de
 * l'icone Messages. Violet fonce et texte blanc (6,2:1), cerclee de blanc pour
 * se detacher de l'icone, meme active. Le nombre est lu par l'intitule du lien.
 */
export default function PastilleNonLus({ nombre, className = "" }) {
  if (!nombre) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="pastille-non-lus"
      className={`grid h-4.5 min-w-4.5 place-items-center rounded-full bg-violet-fonce px-1 text-[0.625rem] leading-none font-bold text-white ring-2 ring-white ${className}`}>
      {nombre > 9 ? "9+" : nombre}
    </span>
  );
}

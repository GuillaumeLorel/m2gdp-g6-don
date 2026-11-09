/**
 * Panneau de la marque, a gauche des ecrans de connexion et d'inscription sur
 * grand ecran. Sur mobile, le formulaire occupe tout l'ecran, comme sur les
 * maquettes ; sur un ordinateur, la moitie gauche presente Doneo avec les
 * photos d'objets et les illustrations de la charte.
 */
const PHOTOS = [
  { src: "/photos/bureau.jpg", classes: "left-[4%] top-[6%] w-[52%] -rotate-3" },
  { src: "/photos/etagere.jpg", classes: "right-[2%] top-[22%] w-[44%] rotate-3" },
  { src: "/photos/chaises.jpg", classes: "left-[14%] bottom-[4%] w-[42%] rotate-2" },
];

export default function PanneauMarque() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-[#a65be0] to-[#c07ce9] text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
      <div aria-hidden="true" className="absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-white/10" />
      <div aria-hidden="true" className="absolute top-1/3 -left-24 size-64 rounded-full bg-white/5" />

      <p className="relative font-titre text-3xl font-semibold tracking-[0.03em]">DONÉO</p>

      <div aria-hidden="true" className="relative mx-auto aspect-[1.15] w-full max-w-lg">
        {PHOTOS.map((p) => (
          <img
            key={p.src}
            src={p.src}
            alt=""
            className={`absolute aspect-[4/3] rounded-3xl border-[6px] border-white object-cover shadow-2xl ${p.classes}`}
          />
        ))}
        <span className="doneo-pastille absolute right-[14%] bottom-[8%] size-28 bg-white shadow-xl">
          <img src="/illustrations/objet-coeur-ruban.svg" alt="" className="size-16" />
        </span>
        <img src="/illustrations/objet-etoile.svg" alt="" className="absolute top-0 right-[40%] size-12" />
      </div>

      <div className="relative">
        <p className="font-titre text-4xl leading-tight font-semibold text-balance">
          Donnez vos objets, soutenez une association.
        </p>
        <p className="mt-3 max-w-md text-white/85 text-pretty">
          Chaque objet donné aide une association et une personne dans le besoin.
        </p>
      </div>
    </aside>
  );
}

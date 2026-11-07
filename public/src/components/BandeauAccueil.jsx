import { Link } from "react-router";
import { Heart, Search } from "lucide-react";

/** Photos d'objets de la maquette (design/photos), allegees pour le web. */
const PHOTOS = [
  { src: "/photos/etagere.jpg", classes: "left-[8%] top-0 w-[46%] -rotate-3" },
  { src: "/photos/bureau.jpg", classes: "right-0 top-[10%] w-[50%] rotate-2" },
  { src: "/photos/vaisselle.jpg", classes: "left-0 bottom-[2%] w-[44%] rotate-2" },
  { src: "/photos/chaises.jpg", classes: "right-[6%] bottom-0 w-[40%] -rotate-3" },
];

/**
 * Bandeau d'accueil du grand ecran. Sur mobile, l'encart violet de la maquette
 * suffit ; sur un ordinateur, la place permet de dire en une phrase ce qu'est
 * Doneo, d'offrir les deux portes d'entree — chercher, donner — et de montrer
 * des objets reels plutot qu'un aplat.
 */
export default function BandeauAccueil({ total }) {
  return (
    <section
      aria-labelledby="titre-bandeau"
      className="relative hidden items-center gap-12 overflow-hidden rounded-[2.5rem] bg-white px-14 py-12 shadow-[0_24px_60px_-36px_rgb(155_77_219/45%)] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Aplats de la charte en fond. */}
      <div aria-hidden="true" className="absolute -top-24 -right-24 size-96 rounded-full bg-lavande/70" />
      <div aria-hidden="true" className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-menthe/50" />

      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-lilas px-3.5 py-1.5 text-sm font-semibold text-violet-fonce">
          <Heart className="size-4 fill-current" aria-hidden="true" />
          Don solidaire, entre voisins lyonnais
        </p>
        <h1 id="titre-bandeau" className="doneo-titre mt-5 text-[3.4rem] leading-[1.02]">
          1 objet, <span className="text-primary">1 don.</span>
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-ardoise/85 text-pretty">
          Donnez un objet, la participation va à l’association de votre choix.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/recherche"
            className="flex h-13 items-center gap-2.5 rounded-full bg-primary px-6 font-titre text-lg font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-violet-fonce">
            <Search className="size-5" aria-hidden="true" />
            Chercher une pépite
          </Link>
          <Link
            to="/creer"
            className="flex h-13 items-center gap-2.5 rounded-full border-[1.5px] border-primary bg-white px-6 font-titre text-lg font-semibold text-violet-fonce transition-colors hover:bg-lilas">
            <Heart className="size-5" aria-hidden="true" />
            Donner un objet
          </Link>
        </div>

        {total > 0 && (
          <p className="mt-8 flex items-center gap-3 text-ardoise">
            <img src="/illustrations/objet-etoile.svg" alt="" aria-hidden="true" className="size-10" />
            <span>
              <strong className="font-titre text-2xl font-semibold text-primary">{total}</strong>{" "}
              pépites à donner en ce moment
            </span>
          </p>
        )}
      </div>

      {/* Collage de photos, ponctue d'illustrations de la charte. */}
      <div aria-hidden="true" className="relative mx-auto aspect-[1.05] w-full max-w-md">
        {PHOTOS.map((p) => (
          <img
            key={p.src}
            src={p.src}
            alt=""
            loading="lazy"
            className={`absolute aspect-[4/3] rounded-3xl border-[6px] border-white object-cover shadow-[0_18px_40px_-20px_rgb(47_79_92/55%)] ${p.classes}`}
          />
        ))}
        <img src="/illustrations/objet-coeur.svg" alt="" className="absolute top-[40%] left-[42%] size-20 -rotate-6 drop-shadow-md" />
        <img src="/illustrations/objet-pousse.svg" alt="" className="absolute -top-4 right-[8%] size-14 rotate-6" />
        <img src="/illustrations/objet-etoile.svg" alt="" className="absolute bottom-[38%] -left-4 size-12" />
      </div>
    </section>
  );
}

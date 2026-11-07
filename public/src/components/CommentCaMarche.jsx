const ETAPES = [
  {
    illustration: "/illustrations/objet-cadeau.svg",
    teinte: "bg-lavande",
    titre: "Un offrant propose un objet",
    texte: "Il le photographie, le décrit et indique un créneau pour venir le chercher.",
  },
  {
    illustration: "/illustrations/objet-coeur-ruban.svg",
    teinte: "bg-menthe",
    titre: "Il choisit une association",
    texte: "Il fixe une participation modeste : c’est l’association, pas lui, qui la reçoit.",
  },
  {
    illustration: "/illustrations/objet-pin-carte.svg",
    teinte: "bg-citron",
    titre: "Un demandeur le récupère",
    texte: "Il verse la participation, puis découvre l’adresse exacte.",
  },
];

/**
 * « Comment ca marche », sur grand ecran : trois etapes illustrees, pour
 * qu'un visiteur comprenne le principe sans rien lire d'autre. Le vocabulaire
 * est celui du projet : offrant, demandeur, participation, association.
 */
export default function CommentCaMarche() {
  return (
    <section aria-labelledby="titre-etapes" className="mt-16 hidden lg:block">
      <h2 id="titre-etapes" className="doneo-titre text-3xl">
        Comment ça marche
      </h2>
      <ol className="mt-6 grid grid-cols-3 gap-6">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="doneo-carte relative flex flex-col p-7">
            <span className="absolute top-6 right-7 font-titre text-5xl font-semibold text-lavande" aria-hidden="true">
              {i + 1}
            </span>
            <span className={`doneo-pastille size-20 ${e.teinte}`}>
              <img src={e.illustration} alt="" aria-hidden="true" className="size-11" />
            </span>
            <h3 className="mt-5 font-titre text-xl font-semibold text-ardoise">{e.titre}</h3>
            <p className="mt-2 leading-7 text-muted-foreground">{e.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

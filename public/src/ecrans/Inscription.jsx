import { useState } from "react";
import { useNavigate } from "react-router";
import { Heart, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import Champ from "@/components/Champ.jsx";
import { enregistrerProfil } from "@/lib/api.js";

/** Aujourd'hui, borne haute du champ : on ne naît pas dans le futur. */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const ROLES = [
  {
    valeur: "offrant",
    titre: "Offrant",
    detail: "Je donne ce dont je n’ai plus l’usage",
    illustration: "/illustrations/objet-cadeau.svg",
  },
  {
    valeur: "demandeur",
    titre: "Demandeur",
    detail: "Je cherche des objets dont j’ai besoin",
    illustration: "/illustrations/expression-heureux.svg",
  },
];

/**
 * Ecran 3 des maquettes : « Finalisez votre profil ».
 *
 * L'email n'est pas saisi ici : il est deja prouve par la connexion, et le
 * Worker le reprend du jeton verifie. Le laisser modifiable ouvrirait la porte
 * a une usurpation d'adresse.
 *
 * Avec `profil`, le meme formulaire sert a modifier son profil (US-36, #68),
 * roles compris : on passe d'offrant a demandeur, ou on cumule les deux, a
 * tout moment.
 */
export default function Inscription({ email, surTermine, profil = null }) {
  const naviguer = useNavigate();
  const [champs, setChamps] = useState(() => ({
    nom: profil?.nom || "",
    prenom: profil?.prenom || "",
    dateNaissance: profil?.dateNaissance?.slice(0, 10) || "",
    roles: profil?.roles || [],
    numeroRue: profil?.numeroRue || "",
    rue: profil?.rue || "",
    complementAdresse: profil?.complementAdresse || "",
    codePostal: profil?.codePostal || "",
    ville: profil?.ville || "",
  }));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  const codePostalValide = /^\d{5}$/.test(champs.codePostal);

  const complet =
    champs.nom.trim() &&
    champs.prenom.trim() &&
    champs.dateNaissance &&
    champs.roles.length &&
    champs.numeroRue.trim() &&
    champs.rue.trim().length >= 2 &&
    codePostalValide &&
    champs.ville.trim();

  const modifier = (cle) => (e) =>
    setChamps((precedent) => ({ ...precedent, [cle]: e.target.value }));

  const basculerRole = (valeur) => (e) =>
    setChamps((precedent) => ({
      ...precedent,
      roles: e.target.checked
        ? [...precedent.roles, valeur]
        : precedent.roles.filter((r) => r !== valeur),
    }));

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      surTermine(await enregistrerProfil({ ...champs, photoUrl: profil?.photoUrl || "" }));
      if (profil) naviguer("/profil", { replace: true, state: { profilModifie: true } });
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <section className="pb-2">
      <header>
        {/* Progression : l'inscription est la 2e des 3 etapes du parcours
            (connexion, profil, accueil). Pas en modification. */}
        {!profil && (
        <div className="flex items-center gap-3.5">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"
            role="presentation">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Étape 2 sur 3
          </span>
        </div>
        )}

        <h1 className={`doneo-titre text-[2rem] leading-tight text-pretty ${profil ? "" : "mt-5"}`}>
          {profil ? "Modifier mon profil" : "Finalisez votre profil"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
          {profil ? "Compte" : "Vous êtes identifié·e comme"}{" "}
          <strong className="font-semibold text-foreground">{email}</strong>.
          {profil
            ? " Vos rôles se changent à tout moment : vous pouvez donner, demander, ou les deux."
            : " Encore quelques informations et vous pourrez donner ou demander vos premiers objets."}
        </p>
      </header>

      <form onSubmit={soumettre} className="mt-7 space-y-4" noValidate>
        {/* Emplacement photo : l'envoi de fichier vers R2 viendra plus tard,
            la pastille tient la place pour ne pas deplacer la mise en page. */}
        <div className="flex justify-center pb-2">
          <div className="relative">
            <div className="grid size-24 place-items-center overflow-hidden rounded-full border-2 border-primary/20 bg-white">
              <img
                src="/illustrations/objet-coeur.svg"
                alt=""
                aria-hidden="true"
                className="size-14"
              />
            </div>
            <span
              className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border-[2.5px] border-background bg-primary text-white shadow-lg shadow-primary/40"
              aria-hidden="true">
              <Pencil className="size-3.5" />
            </span>
          </div>
        </div>

        <Champ
          id="nom"
          etiquette="Nom"
          required
          autoComplete="family-name"
          placeholder="Dupont"
          value={champs.nom}
          onChange={modifier("nom")}
        />

        <Champ
          id="prenom"
          etiquette="Prénom"
          required
          autoComplete="given-name"
          placeholder="Marie"
          value={champs.prenom}
          onChange={modifier("prenom")}
        />

        <Champ
          id="naissance"
          etiquette="Date de naissance"
          type="date"
          required
          autoComplete="bday"
          max={aujourdhui()}
          value={champs.dateNaissance}
          onChange={modifier("dateNaissance")}
        />

        {/* Numero et rue sur une meme ligne : c'est ainsi qu'on ecrit une
            adresse, et le numero n'a pas besoin de toute la largeur. */}
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Champ
            id="numeroRue"
            etiquette="N°"
            required
            maxLength={10}
            placeholder="12 bis"
            value={champs.numeroRue}
            onChange={modifier("numeroRue")}
          />
          <Champ
            id="rue"
            etiquette="Rue"
            required
            autoComplete="street-address"
            placeholder="rue de la République"
            value={champs.rue}
            onChange={modifier("rue")}
          />
        </div>

        <Champ
          id="complement"
          etiquette="Complément (facultatif)"
          maxLength={100}
          placeholder="Bât. B, appt 12"
          value={champs.complementAdresse}
          onChange={modifier("complementAdresse")}
        />

        {/* Code postal et ville vont ensemble : les separer sur deux lignes
            donnerait un formulaire plus long sans rien clarifier. */}
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Champ
            id="codePostal"
            etiquette="Code postal"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="69002"
            value={champs.codePostal}
            onChange={(e) =>
              setChamps((p) => ({
                ...p,
                codePostal: e.target.value.replace(/\D/g, "").slice(0, 5),
              }))
            }
          />
          <Champ
            id="ville"
            etiquette="Ville"
            required
            autoComplete="address-level2"
            placeholder="Lyon"
            value={champs.ville}
            onChange={modifier("ville")}
          />
        </div>

        <p className="text-xs leading-5 text-muted-foreground text-pretty">
          Les objets se récupèrent en main propre : votre ville et votre code
          postal sont visibles par les autres membres. Votre adresse exacte,
          elle, reste privée.
        </p>

        <fieldset className="space-y-3 pt-2">
          <legend className="doneo-etiquette">{profil ? "Mes rôles" : "Je m’inscris en tant que"}</legend>
          <p className="text-xs leading-5 text-muted-foreground text-pretty">
            Les deux sont possibles : on peut donner ce dont on n’a plus l’usage
            et chercher autre chose.
          </p>

          {/* Case native masquee plutot que le Checkbox de shadcn : la carte
              entiere devient la cible, et `has-checked:` suffit a la peindre.
              Le clavier et les lecteurs d'ecran gardent le comportement natif. */}
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((role) => (
              <label
                key={role.valeur}
                className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-primary/20 bg-white p-5 text-center transition-all
                           has-checked:border-primary has-checked:bg-primary/5 has-checked:shadow-lg has-checked:shadow-primary/20
                           has-focus-visible:ring-4 has-focus-visible:ring-primary/20">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={champs.roles.includes(role.valeur)}
                  onChange={basculerRole(role.valeur)}
                />
                <span className="grid size-13 place-items-center rounded-2xl bg-lavande/60">
                  <img
                    src={role.illustration}
                    alt=""
                    aria-hidden="true"
                    className="size-10"
                  />
                </span>
                <span>
                  <span className="doneo-titre block text-[1.05rem]">
                    {role.titre}
                  </span>
                  <span className="mt-1 block text-xs leading-[1.45] text-muted-foreground text-pretty">
                    {role.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {erreur && (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        {/* Le bouton colle au bas de l'ecran pendant le defilement : le
            formulaire est long, on ne veut pas obliger a redescendre. */}
        <div className={profil ? "pt-2" : "sticky bottom-0 -mx-6 bg-linear-to-t from-background from-65% to-transparent px-6 pt-4 pb-5 sm:-mx-8 sm:px-8"}>
          <Button
            type="submit"
            variant="doneo"
            size="pilule"
            className="w-full"
            disabled={envoi || !complet}>
            {envoi ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Heart className="size-5 fill-current" aria-hidden="true" />
            )}
            {envoi ? "Enregistrement…" : profil ? "Enregistrer" : "Créer mon compte"}
          </Button>
        </div>
      </form>
    </section>
  );
}

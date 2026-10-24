import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import Champ from "@/components/Champ.jsx";
import Logo from "@/components/Logo.jsx";
import { envoyerLienMagique } from "@/lib/auth.js";
import { statutEmail } from "@/lib/api.js";

/**
 * Ecran 1 des maquettes : « Connexion ».
 *
 * Une seule saisie, pas de mot de passe. On interroge le backend pour savoir si
 * l'adresse a deja un compte : cela ne change rien au lien envoye (Supabase
 * gere les deux cas), mais cela permet d'annoncer honnetement ce qui va se
 * passer — « lien de connexion » ou « lien d'inscription ».
 */
export default function Connexion() {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | envoye
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEtat("envoi");

    try {
      const existe = await statutEmail(email.trim().toLowerCase());
      await envoyerLienMagique(email.trim().toLowerCase());
      setDejaInscrit(existe);
      setEtat("envoye");
    } catch (e) {
      setErreur(e.message);
      setEtat("saisie");
    }
  }

  /* Confirmation d'envoi : meme mise en page que l'ecran « Demande envoyee »
     des maquettes — grande pastille, titre, puis les actions en bas. */
  if (etat === "envoye") {
    return (
      <section className="flex flex-1 flex-col">
        <div className="flex flex-col items-center pt-10 text-center">
          <div className="doneo-pastille size-38">
            <img
              src="/illustrations/expression-celebration.svg"
              alt=""
              aria-hidden="true"
              className="size-28"
            />
          </div>

          <h1 className="doneo-titre mt-7 text-3xl">Consultez vos e-mails</h1>
          <p className="mt-2.5 max-w-76 text-[0.95rem] leading-6 text-muted-foreground">
            {dejaInscrit
              ? "Un lien de connexion vient d’être envoyé à "
              : "Un lien pour créer votre compte vient d’être envoyé à "}
            <strong className="font-semibold text-foreground">{email}</strong>.
          </p>
        </div>

        <div className="doneo-carte mt-7 flex items-start gap-3 p-4">
          <img
            src="/illustrations/objet-etoile.svg"
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0"
          />
          <p className="text-[0.8rem] leading-5 text-muted-foreground">
            Le lien est valable une heure et ne fonctionne qu’une fois. Pensez à
            regarder vos indésirables.
          </p>
        </div>

        <div className="mt-auto pt-8">
          <Button
            variant="doneoSecondaire"
            size="pilule"
            className="w-full"
            onClick={() => setEtat("saisie")}>
            <Heart className="size-5" aria-hidden="true" />
            Utiliser une autre adresse
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pt-6 text-center">
        <Logo variante="mot" />

        <h1 className="doneo-titre mt-4 text-[2rem]">Connexion</h1>
        <p className="mt-2 max-w-68 text-[0.95rem] leading-6 text-muted-foreground">
          Entrez votre e-mail pour recevoir un lien de connexion.
        </p>

        <img
          src="/illustrations/objet-coeur.svg"
          alt=""
          aria-hidden="true"
          className="mt-7 size-19"
        />
      </div>

      {/* Le formulaire est pousse en bas : le pouce y accede sans effort, et
          c'est la composition retenue par les maquettes. */}
      <form
        onSubmit={soumettre}
        className="mt-auto space-y-3.5 pt-10"
        noValidate>
        <Champ
          id="email"
          etiquette="Adresse e-mail"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="prenom@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={erreur ? "true" : undefined}
        />

        {erreur && (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}

        <Button
          type="submit"
          variant="doneo"
          size="pilule"
          className="w-full"
          disabled={etat === "envoi" || !email}>
          {etat === "envoi" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Heart className="size-5 fill-current" aria-hidden="true" />
          )}
          {etat === "envoi" ? "Envoi en cours…" : "Recevoir le lien magique"}
        </Button>

        <p className="text-center text-[0.8rem] text-muted-foreground">
          Pas de mot de passe à retenir !
        </p>
      </form>
    </section>
  );
}

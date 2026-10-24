import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import Champ from "@/components/Champ.jsx";
import Logo from "@/components/Logo.jsx";
import { envoyerLienMagique, verifierCode } from "@/lib/auth.js";
import { statutEmail } from "@/lib/api.js";

/**
 * Ecran 1 des maquettes : « Connexion ».
 *
 * Pas de mot de passe : l'adresse e-mail, puis le code a 6 chiffres recu. On
 * interroge le backend pour savoir si l'adresse a deja un compte : cela ne
 * change rien au code envoye (Supabase gere les deux cas), mais cela permet
 * d'annoncer honnetement ce qui va se passer — connexion ou inscription.
 */
export default function Connexion() {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | envoye
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState(false);
  const [erreurCode, setErreurCode] = useState(null);

  // Une fois le code accepte, la session s'ouvre et App bascule d'elle-meme
  // sur l'accueil : rien d'autre a faire ici.
  async function validerCode(evenement) {
    evenement.preventDefault();
    setErreurCode(null);
    setVerification(true);
    try {
      await verifierCode(email.trim().toLowerCase(), code);
    } catch (e) {
      setErreurCode(e.message);
      setVerification(false);
    }
  }

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

  /* Code envoye : meme mise en page que l'ecran « Demande envoyee » des
     maquettes — pastille, titre —, avec la saisie du code juste dessous, et
     pastille reduite pour que le champ reste visible clavier ouvert. */
  if (etat === "envoye") {
    return (
      <section className="flex flex-1 flex-col">
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="doneo-pastille size-28">
            <img
              src="/illustrations/expression-celebration.svg"
              alt=""
              aria-hidden="true"
              className="size-20"
            />
          </div>

          <h1 className="doneo-titre mt-5 text-3xl">
            Consultez vos <span className="whitespace-nowrap">e-mails</span>
          </h1>
          <p className="mt-2.5 max-w-76 text-[0.95rem] leading-6 text-muted-foreground">
            {dejaInscrit
              ? "Un code de connexion vient d’être envoyé à "
              : "Un code pour créer votre compte vient d’être envoyé à "}
            <strong className="font-semibold text-foreground">{email}</strong>.
          </p>
        </div>

        {/* Pas de lien dans l'e-mail : le filtre anti-spam de Lyon 2 rejette
            les e-mails qui en contiennent (voir lib/auth.js). */}
        <form onSubmit={validerCode} className="mt-6 space-y-3" noValidate>
          <Champ
            id="code"
            etiquette="Code reçu par e-mail"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={erreurCode ? "true" : undefined}
          />
          {erreurCode && (
            <p role="alert" className="text-sm text-destructive">
              {erreurCode}
            </p>
          )}
          <Button
            type="submit"
            variant="doneo"
            size="pilule"
            className="w-full"
            disabled={verification || code.replace(/\s/g, "").length < 6}>
            {verification && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
            {verification ? "Vérification…" : "Valider le code"}
          </Button>
        </form>

        <div className="doneo-carte mt-6 flex items-start gap-3 p-4">
          <img
            src="/illustrations/objet-etoile.svg"
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0"
          />
          <p className="text-[0.8rem] leading-5 text-muted-foreground">
            Le code est valable une heure et ne sert qu’une fois. Rien reçu ?
            Regardez vos indésirables.
          </p>
        </div>

        <div className="mt-auto pt-6">
          <Button
            variant="doneoSecondaire"
            size="pilule"
            className="w-full"
            onClick={() => {
              setCode("");
              setErreurCode(null);
              setEtat("saisie");
            }}>
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
          Entrez votre e-mail pour recevoir un code de connexion.
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
          {etat === "envoi" ? "Envoi en cours…" : "Recevoir mon code"}
        </Button>

        <p className="text-center text-[0.8rem] text-muted-foreground">
          Pas de mot de passe à retenir !
        </p>
      </form>
    </section>
  );
}

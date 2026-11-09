import { useEffect, useState } from "react";
import { EyeOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { chargerQuestions, masquerQuestion, poserQuestion, repondreQuestion, supprimerQuestion } from "@/lib/api.js";
import { nomOffrant } from "@/lib/format.js";

const LONGUEUR_MAX = 500;
const CLASSES_SAISIE =
  "w-full resize-none rounded-[1.25rem] border-[1.5px] border-primary/20 bg-white px-4 py-3 text-base outline-none focus-visible:border-primary";
const CLASSES_LIEN = "text-sm font-semibold text-violet-fonce disabled:opacity-50";

const dateCourte = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Zone de saisie d'une question ou d'une reponse, avec son compteur. */
function Saisie({ id, etiquette, aide, valeur, surChangement, enCours, surEnvoi, libelleEnvoi, surAnnulation }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="doneo-etiquette">{etiquette}</label>
      <textarea
        id={id}
        rows={2}
        maxLength={LONGUEUR_MAX}
        value={valeur}
        onChange={(e) => surChangement(e.target.value)}
        className={CLASSES_SAISIE}
      />
      <p className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{aide}</span>
        <span aria-hidden="true">{valeur.length}/{LONGUEUR_MAX}</span>
      </p>
      <div className="flex items-center gap-4">
        <Button variant="doneoSecondaire" size="pilule" disabled={enCours || !valeur.trim()} onClick={surEnvoi}>
          {enCours && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {libelleEnvoi}
        </Button>
        {surAnnulation && (
          <button type="button" className={CLASSES_LIEN} onClick={surAnnulation}>Annuler</button>
        )}
      </div>
    </div>
  );
}

/**
 * Questions publiques sous une annonce (EPIC 9) : un demandeur pose une
 * question, l'offrant y repond une fois. Visible de tous, a la difference de
 * la messagerie. L'auteur supprime sa question ; l'offrant masque ou retablit.
 */
export default function QuestionsPubliques({ annonce, profil, estLaMienne }) {
  const [questions, setQuestions] = useState(undefined); // undefined = chargement, null = erreur
  const [question, setQuestion] = useState("");
  const [reponses, setReponses] = useState({}); // id -> brouillon de reponse en cours
  const [action, setAction] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    chargerQuestions(annonce.id)
      .then((liste) => actif && setQuestions(liste))
      .catch(() => actif && setQuestions(null));
    return () => {
      actif = false;
    };
  }, [annonce.id]);

  const peutDemander =
    !estLaMienne && annonce.statut !== "remis" && profil.roles?.includes("demandeur");

  async function agir(cle, operation) {
    setAction(cle);
    setErreur(null);
    try {
      await operation();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setAction(null);
    }
  }

  const remplacer = (maj) => setQuestions((liste) => liste.map((q) => (q.id === maj.id ? maj : q)));

  const publier = () =>
    agir("question", async () => {
      const nouvelle = await poserQuestion(annonce.id, question.trim());
      setQuestions((liste) => [...(liste || []), nouvelle]);
      setQuestion("");
    });

  const envoyerReponse = (id) =>
    agir(`reponse-${id}`, async () => {
      remplacer(await repondreQuestion(id, reponses[id].trim()));
      setReponses(({ [id]: _, ...reste }) => reste);
    });

  const basculerMasquage = (q) =>
    agir(`masquage-${q.id}`, async () => remplacer(await masquerQuestion(q.id, q.statut !== "masque")));

  const supprimer = (id) =>
    agir(`suppression-${id}`, async () => {
      await supprimerQuestion(id);
      setQuestions((liste) => liste.filter((q) => q.id !== id));
    });

  return (
    <section aria-labelledby="titre-questions" className="mt-6">
      <h2 id="titre-questions" className="doneo-etiquette">
        Questions publiques{questions?.length ? ` (${questions.length})` : ""}
      </h2>

      {questions === undefined && <div className="mt-3 h-16 animate-pulse rounded-3xl bg-lavande" />}
      {questions === null && (
        <p className="mt-2 text-sm text-muted-foreground">Les questions n’ont pas pu être chargées.</p>
      )}
      {questions?.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {estLaMienne ? "Aucune question pour l’instant." : "Aucune question pour l’instant. Posez la première !"}
        </p>
      )}

      {questions?.length > 0 && (
        <ul className="mt-3 space-y-3">
          {questions.map((q) => {
            const masquee = q.statut === "masque";
            const enReponse = reponses[q.id] !== undefined;
            return (
              <li key={q.id} className={`doneo-carte p-4 ${masquee ? "opacity-70" : ""}`}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold text-ardoise">{nomOffrant(q.auteur)}</span>
                  <span className="text-xs text-muted-foreground">{dateCourte(q.creeLe)}</span>
                </p>
                {masquee && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <EyeOff className="size-3.5" aria-hidden="true" />
                    Masquée : visible de vous seul
                  </p>
                )}
                <p className="mt-1.5 text-ardoise whitespace-pre-line text-pretty">{q.contenu}</p>

                {q.reponse && !enReponse && (
                  <div className="mt-3 rounded-2xl bg-lavande p-3">
                    <p className="text-xs font-semibold text-violet-fonce">
                      {estLaMienne ? "Votre réponse" : `Réponse de ${annonce.offrant?.prenom || "l’offrant"}`}
                    </p>
                    <p className="mt-1 text-sm text-ardoise whitespace-pre-line text-pretty">{q.reponse.contenu}</p>
                  </div>
                )}

                {estLaMienne && enReponse && (
                  <div className="mt-3">
                    <Saisie
                      id={`reponse-${q.id}`}
                      etiquette="Votre réponse"
                      aide="Publique : n’y écrivez pas votre adresse."
                      valeur={reponses[q.id]}
                      surChangement={(texte) => setReponses((r) => ({ ...r, [q.id]: texte }))}
                      enCours={action === `reponse-${q.id}`}
                      surEnvoi={() => envoyerReponse(q.id)}
                      libelleEnvoi="Publier la réponse"
                      surAnnulation={() => setReponses(({ [q.id]: _, ...reste }) => reste)}
                    />
                  </div>
                )}

                {(estLaMienne || q.auteur?.id === profil.id) && !enReponse && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                    {estLaMienne && (
                      <button
                        type="button"
                        className={CLASSES_LIEN}
                        onClick={() => setReponses((r) => ({ ...r, [q.id]: q.reponse?.contenu || "" }))}>
                        {q.reponse ? "Modifier la réponse" : "Répondre"}
                      </button>
                    )}
                    {estLaMienne && (
                      <button
                        type="button"
                        className={CLASSES_LIEN}
                        disabled={action === `masquage-${q.id}`}
                        onClick={() => basculerMasquage(q)}>
                        {masquee ? "Rétablir" : "Masquer"}
                      </button>
                    )}
                    {q.auteur?.id === profil.id && (
                      <button
                        type="button"
                        className={`${CLASSES_LIEN} inline-flex items-center gap-1`}
                        disabled={action === `suppression-${q.id}`}
                        onClick={() => supprimer(q.id)}>
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Supprimer ma question
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {peutDemander && questions !== null && (
        <div className="mt-4">
          <Saisie
            id="nouvelle-question"
            etiquette="Poser une question"
            aide="Visible de tous. Pour le retrait, écrivez plutôt à l’offrant."
            valeur={question}
            surChangement={setQuestion}
            enCours={action === "question"}
            surEnvoi={publier}
            libelleEnvoi="Publier la question"
          />
        </div>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
    </section>
  );
}

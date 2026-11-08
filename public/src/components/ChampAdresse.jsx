import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { CLASSES_CHAMP } from "@/components/Champ.jsx";
import { chercherAdresses } from "@/lib/adresses.js";

const ATTENTE_MS = 300;
const MIN_CARACTERES = 3;

/**
 * Champ de recherche d'adresse avec suggestions (US-49, #129). Choisir une
 * suggestion remplit numero, rue, code postal et ville via `surChoix` ; le
 * complement reste a saisir. Si le service ne repond pas ou ne trouve rien,
 * rien ne s'affiche : les champs en dessous se remplissent a la main.
 */
export default function ChampAdresse({ id, surChoix, etiquette = "Chercher mon adresse" }) {
  const idListe = `${useId()}-suggestions`;
  const [texte, setTexte] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  // Apres un choix, le libelle reste dans le champ sans relancer de recherche.
  const sautee = useRef(null);

  useEffect(() => {
    const saisie = texte.trim();
    if (saisie.length < MIN_CARACTERES || sautee.current === texte) {
      setSuggestions([]);
      return undefined;
    }
    const controle = new AbortController();
    const minuterie = setTimeout(() => {
      chercherAdresses(saisie, controle.signal)
        .then((liste) => {
          setSuggestions(liste);
          setActif(-1);
        })
        .catch(() => !controle.signal.aborted && setSuggestions([]));
    }, ATTENTE_MS);
    return () => {
      clearTimeout(minuterie);
      controle.abort();
    };
  }, [texte]);

  const afficher = ouvert && suggestions.length > 0;

  function choisir(adresse) {
    sautee.current = adresse.label;
    setTexte(adresse.label);
    setSuggestions([]);
    setOuvert(false);
    // Le second argument est la position du point, pour qui veut chercher autour.
    surChoix(
      {
        numeroRue: adresse.numeroRue,
        rue: adresse.rue,
        codePostal: adresse.codePostal,
        ville: adresse.ville,
      },
      { latitude: adresse.latitude, longitude: adresse.longitude },
    );
  }

  function touche(e) {
    if (e.key === "Escape") return setOuvert(false);
    if (!afficher) return undefined;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && actif >= 0) {
      e.preventDefault();
      choisir(suggestions[actif]);
    }
    return undefined;
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor={id} className="doneo-etiquette">
        {etiquette}
      </Label>
      <Input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={afficher}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={afficher && actif >= 0 ? `${idListe}-${actif}` : undefined}
        placeholder="12 rue de la République"
        className={CLASSES_CHAMP}
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onKeyDown={touche}
      />
      {afficher && (
        <ul
          id={idListe}
          role="listbox"
          aria-label="Adresses suggérées"
          className="absolute inset-x-0 z-20 overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-lg shadow-primary/10">
          {suggestions.map((a, i) => (
            <li
              key={a.label}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === actif}
              // Le clic arrive apres le blur du champ : sans ceci, la liste se
              // fermerait avant de recevoir le choix.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(a)}
              className={`flex cursor-pointer items-start gap-2.5 px-4 py-3 text-sm break-words text-ardoise ${
                i === actif ? "bg-lavande" : "hover:bg-lilas"
              }`}>
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">{a.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

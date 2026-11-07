/**
 * Meteo du creneau de retrait (US-10, #38) : Open-Meteo, sans cle, appelable
 * depuis le navigateur. Seule la position APPROCHEE de l'annonce est envoyee,
 * jamais l'adresse exacte. Les heures sont demandees en UTC, comme les
 * creneaux.
 */
const SERVICE = "https://api.open-meteo.com/v1/forecast";

/** Codes meteo WMO regroupes : libelle et icone. */
const CODES = [
  [[0], "Ciel dégagé", "☀️"],
  [[1, 2], "Peu nuageux", "🌤️"],
  [[3], "Couvert", "☁️"],
  [[45, 48], "Brouillard", "🌫️"],
  [[51, 53, 55, 56, 57], "Bruine", "🌦️"],
  [[61, 63, 65, 66, 67], "Pluie", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Neige", "❄️"],
  [[80, 81, 82], "Averses", "🌦️"],
  [[95, 96, 99], "Orage", "⛈️"],
];

export function decrireCode(code) {
  const [, libelle, icone] = CODES.find(([codes]) => codes.includes(code)) || [[], "Variable", "🌡️"];
  return { libelle, icone };
}

const jourUTC = (date) => date.toISOString().slice(0, 10);

/**
 * Prevision pendant le creneau, ou `null` : creneau passe, trop lointain pour
 * les previsions, position inconnue ou service indisponible. Ne leve jamais :
 * la fiche reste lisible sans meteo.
 *
 * @returns {Promise<{libelle: string, icone: string, temperatureC: number, probabilitePluie: number} | null>}
 */
export async function chargerMeteoCreneau({ latitude, longitude, creneau }, signal) {
  const debut = new Date(creneau?.debut);
  const fin = new Date(creneau?.fin);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < new Date()) return null;

  try {
    const url = new URL(SERVICE);
    url.search = new URLSearchParams({
      latitude: latitude.toFixed(2),
      longitude: longitude.toFixed(2),
      hourly: "temperature_2m,precipitation_probability,weathercode",
      timezone: "UTC",
      start_date: jourUTC(debut),
      end_date: jourUTC(fin),
    }).toString();
    const reponse = await fetch(url, { signal });
    if (!reponse.ok) return null; // au-dela de l'horizon de prevision : 400
    const { hourly } = await reponse.json();

    // Les heures du creneau : celles qui le recouvrent, au moins une.
    const heures = hourly.time
      .map((t, i) => ({
        debut: new Date(`${t}:00Z`),
        temperature: hourly.temperature_2m[i],
        pluie: hourly.precipitation_probability[i],
        code: hourly.weathercode[i],
      }))
      .filter((h) => h.debut < fin && new Date(h.debut.getTime() + 3600_000) > debut);
    if (!heures.length) return null;

    const temperatures = heures.map((h) => h.temperature).filter(Number.isFinite);
    const pluies = heures.map((h) => h.pluie).filter(Number.isFinite);
    // Le pire moment du creneau resume le temps : la pluie compte plus qu'un ciel clair.
    const pire = heures.reduce((a, b) => ((b.pluie ?? 0) > (a.pluie ?? 0) ? b : a), heures[0]);
    if (!temperatures.length) return null;
    return {
      ...decrireCode(pire.code),
      temperatureC: Math.round(temperatures.reduce((s, t) => s + t, 0) / temperatures.length),
      probabilitePluie: pluies.length ? Math.max(...pluies) : 0,
    };
  } catch {
    return null;
  }
}

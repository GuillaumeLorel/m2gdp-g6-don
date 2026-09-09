/**
 * Worker Cloudflare — Backend m2gdp-g6-don (enchères caritatives)
 *
 * Logique métier + passerelle vers les services auto-gérés :
 *  - Firebase Auth (lien magique)
 *  - Firestore (données) / Realtime DB (messages)
 *  - Cloudflare D1 (sessions) / R2 (fichiers)
 *
 * Squelette de départ : à enrichir US par US.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // à restreindre au domaine du front en prod
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    // Préflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Healthcheck
    if (path === "/api/health") {
      return json({ status: "ok", service: "m2gdp-g6-don", ts: Date.now() });
    }

    // --- Enchères (annonces) ---
    // if (path === "/api/annonces" && request.method === "GET")  { ... }
    // if (path === "/api/annonces" && request.method === "POST") { ... }

    // --- Offres / enchères ---
    // if (path === "/api/offres" && request.method === "POST")   { ... }

    // --- Auth (lien magique Firebase) ---
    // if (path === "/api/auth/magic-link" && request.method === "POST") { ... }

    return json({ error: "Route non trouvée", path }, 404);
  },
};

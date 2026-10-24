// Configuration publique du front.
//
// La cle `sb_publishable_…` est PUBLIQUE par conception : elle est livree dans
// le bundle navigateur et ne sert ici qu'a l'authentification. Les tables de
// donnees sont fermees a cette cle (Row Level Security sans regle) : seul le
// Worker, avec la cle secrete, y lit et ecrit.

/** Projet Supabase (region UE, eu-west-1). */
export const SUPABASE_URL = 'https://ocapkeuidpuhcsnerkse.supabase.co';
export const SUPABASE_CLE_PUBLIQUE = 'sb_publishable_mmvcB0QIyEEAJp911GOcUw_xyanIiwK';

/**
 * URL du backend Cloudflare Workers. En local, VITE_API_BASE permet de viser
 * un Worker lance par `wrangler dev` (voir docs/SETUP.md) ; sans elle, on
 * appelle le Worker en ligne.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://doneo-api.guillaume-lorel.workers.dev';

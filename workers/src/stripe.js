/**
 * Paiement par Stripe, en MODE TEST uniquement (AGENTS.md) : un vrai tunnel de
 * paiement (Stripe Checkout, carte de test 4242 4242 4242 4242), une vraie
 * reference de transaction, et aucun euro qui change de main. La cle secrete
 * de test (sk_test_...) est un secret du Worker : STRIPE_SECRET_KEY.
 */

const API = 'https://api.stripe.com/v1';

async function appelerStripe(env, chemin, parametres) {
  const reponse = await fetch(`${API}/${chemin}`, {
    method: parametres ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(parametres ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: parametres ? new URLSearchParams(parametres) : undefined,
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`Stripe ${reponse.status} : ${corps.error?.message || JSON.stringify(corps)}`);
  return corps;
}

/** Vrai si une cle de TEST est configuree. Une cle de production est refusee. */
export const paiementDisponible = (env) => typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_test_');

/**
 * Ouvre une session de paiement. Stripe refuse les montants sous 0,50 € : une
 * participation plus faible est presentee a 0,50 € dans le tunnel de test,
 * ce qui ne change rien puisque rien n'est debite.
 */
export function creerSessionPaiement(env, { montant, libelle, description, reservationId, urlSucces, urlAnnulation }) {
  const centimes = Math.max(Math.round(montant * 100), 50);
  return appelerStripe(env, 'checkout/sessions', {
    mode: 'payment',
    locale: 'fr',
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(centimes),
    'line_items[0][price_data][product_data][name]': libelle,
    'line_items[0][price_data][product_data][description]': description,
    client_reference_id: reservationId,
    'metadata[reservationId]': reservationId,
    success_url: urlSucces,
    cancel_url: urlAnnulation,
  });
}

/** Une session de paiement, pour verifier qu'elle a ete payee. */
export const lireSessionPaiement = (env, id) => appelerStripe(env, `checkout/sessions/${encodeURIComponent(id)}`);

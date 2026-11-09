/**
 * Envoi d'un e-mail par SMTP (Gmail, port 587 avec STARTTLS), depuis le Worker.
 *
 * Pas de service d'envoi tiers : sans nom de domaine, Lyon 2 refuse les
 * e-mails de Brevo, alors qu'il accepte ceux de Gmail (essais du 24/10/2026).
 * Identifiants : secrets SMTP_UTILISATEUR (l'adresse Gmail) et
 * SMTP_MOT_DE_PASSE (un mot de passe d'application Google, pas celui du compte).
 */

const SERVEUR = { hostname: 'smtp.gmail.com', port: 587 };

/** Base64 d'un texte UTF-8 (btoa n'accepte que l'ASCII). */
function base64(texte) {
  let binaire = '';
  for (const octet of new TextEncoder().encode(texte)) binaire += String.fromCharCode(octet);
  return btoa(binaire);
}

/** En-tete encode (objet, nom d'expediteur) : les accents passent partout. */
const enTeteUtf8 = (texte) => `=?UTF-8?B?${base64(texte)}?=`;

/**
 * Le message complet, en-tetes et corps. Le corps est en base64 : aucun
 * caractere ne pose probleme, et aucune ligne ne commence par un point (qui
 * terminerait le message en SMTP).
 */
export function construireMessage({ de, a, objet, texte }) {
  const corps = base64(texte.replace(/\r?\n/g, '\r\n')).match(/.{1,76}/g).join('\r\n');
  return [
    `From: ${enTeteUtf8('Donéo')} <${de}>`,
    `To: <${a}>`,
    `Subject: ${enTeteUtf8(objet)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@doneo>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    corps,
  ].join('\r\n');
}

/** Envoie un e-mail. Leve une erreur si le serveur refuse une etape. */
export async function envoyerSmtp(env, { a, objet, texte }) {
  // Import a l'appel : le module se charge aussi hors du Worker (tests).
  const { connect } = await import('cloudflare:sockets');
  const de = env.SMTP_UTILISATEUR;
  let socket = connect(SERVEUR, { secureTransport: 'starttls' });
  let lecteur, ecrivain;
  let tampon = '';
  const decodeur = new TextDecoder();
  const brancher = () => {
    lecteur = socket.readable.getReader();
    ecrivain = socket.writable.getWriter();
    tampon = '';
  };

  /** Code de la reponse ; une reponse sur plusieurs lignes finit par « 250 ». */
  async function reponse() {
    for (;;) {
      const lignes = tampon.split('\r\n');
      const fin = lignes.slice(0, -1).findIndex((l) => /^\d{3} /.test(l));
      if (fin !== -1) {
        tampon = lignes.slice(fin + 1).join('\r\n');
        return Number(lignes[fin].slice(0, 3));
      }
      const { value, done } = await lecteur.read();
      if (done) throw new Error('SMTP : connexion fermée par le serveur');
      tampon += decodeur.decode(value, { stream: true });
    }
  }
  async function commande(ligne, attendu, nom = ligne.split(' ')[0]) {
    await ecrivain.write(new TextEncoder().encode(`${ligne}\r\n`));
    const code = await reponse();
    if (code !== attendu) throw new Error(`SMTP : ${code} après ${nom}`);
  }

  brancher();
  try {
    if ((await reponse()) !== 220) throw new Error('SMTP : accueil inattendu');
    await commande('EHLO doneo', 250);
    await commande('STARTTLS', 220);
    lecteur.releaseLock();
    ecrivain.releaseLock();
    socket = socket.startTls();
    brancher();
    await commande('EHLO doneo', 250);
    await commande(`AUTH PLAIN ${base64(`\0${de}\0${env.SMTP_MOT_DE_PASSE}`)}`, 235, 'AUTH');
    await commande(`MAIL FROM:<${de}>`, 250, 'MAIL FROM');
    await commande(`RCPT TO:<${a}>`, 250, 'RCPT TO');
    await commande('DATA', 354);
    await commande(`${construireMessage({ de, a, objet, texte })}\r\n.`, 250, 'le message');
    await commande('QUIT', 221).catch(() => {});
  } finally {
    await socket.close().catch(() => {});
  }
}

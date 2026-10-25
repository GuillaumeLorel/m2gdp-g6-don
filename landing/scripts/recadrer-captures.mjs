// Recadre les exports de maquettes (étiquette « 04 Accueil » + contour du
// téléphone) pour ne garder que l'écran, à partir de la barre de statut.
// Usage : node scripts/recadrer-captures.mjs [nom ...]  (nécessite `npm i sharp`)
import sharp from 'sharp';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dossier = join(dirname(fileURLToPath(import.meta.url)), '../public/assets/screens');
const originaux = join(dossier, 'originaux');
const fichiers = process.argv.length > 2
  ? process.argv.slice(2)
  : ['accueil', 'creation-annonce', 'recherche-carte', 'visualisation-annonce'];

// Couleur du contour de la maquette (Lavande #E8D7F6)
const estContour = ([r, g, b, a]) =>
  a === 255 && Math.abs(r - 232) < 4 && Math.abs(g - 215) < 4 && Math.abs(b - 246) < 4;

mkdirSync(originaux, { recursive: true });

for (const nom of fichiers) {
  let source = join(dossier, `${nom}.png`);
  if (!existsSync(source)) source = join(originaux, `${nom}.png`);
  if (!existsSync(source)) {
    console.warn(`${nom}.png introuvable, ignoré`);
    continue;
  }

  const { data, info } = await sharp(source).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => Array.from(data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
  const xm = Math.floor(W / 2);
  const ym = Math.floor(H / 2);

  // Haut : première ligne de contour sous l'étiquette, puis on la saute
  let haut = 0;
  while (haut < H && !estContour(px(xm, haut))) haut++;
  while (haut < H && estContour(px(xm, haut))) haut++;
  // Bas
  let bas = H - 1;
  while (bas > 0 && !estContour(px(xm, bas))) bas--;
  while (bas > 0 && estContour(px(xm, bas))) bas--;
  // Gauche / droite, à mi-hauteur
  let gauche = 0;
  while (gauche < W && estContour(px(gauche, ym))) gauche++;
  let droite = W - 1;
  while (droite > 0 && estContour(px(droite, ym))) droite--;

  const zone = { left: gauche, top: haut, width: droite - gauche + 1, height: bas - haut + 1 };
  const sortie = join(dossier, `${nom}.webp`);
  await sharp(source).extract(zone).webp({ quality: 85 }).toFile(sortie);

  if (source !== join(originaux, `${nom}.png`)) renameSync(source, join(originaux, `${nom}.png`));
  console.log(`${nom} : ${W}×${H} → ${zone.width}×${zone.height} (découpe x=${zone.left}, y=${zone.top})`);
}

/**
 * Applique les migrations SQL de supabase/migrations/, dans l'ordre.
 *
 *   node scripts/donnees/appliquer-migrations.mjs
 *
 * Les migrations sont ecrites pour etre rejouables (create ... if not
 * exists) : relancer ne casse rien.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { RACINE_DEPOT, configurationPostgres } from './supabase-admin.mjs';

const dossier = path.join(RACINE_DEPOT, 'supabase/migrations');
const client = new pg.Client(configurationPostgres());
await client.connect();
try {
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(path.join(dossier, fichier), 'utf8'));
    console.log('applique :', fichier);
  }
  const { rows } = await client.query(
    `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
  );
  for (const t of rows) console.log(`  ${t.tablename.padEnd(14)} RLS ${t.rowsecurity ? 'active' : 'INACTIVE'}`);
} finally {
  await client.end();
}

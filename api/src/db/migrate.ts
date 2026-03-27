import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pool, query } from './index.js';

async function migrate(): Promise<void> {
  console.log('Running migrations...');

  // Ensure migrations table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await query<{ filename: string }>('SELECT filename FROM _migrations'))
      .map((r) => r.filename),
  );

  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }

    console.log(`  ▶ Applying ${file}...`);
    const sql = readFileSync(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${file} FAILED:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

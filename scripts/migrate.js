import pg from 'pg';

async function run() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.log('[migrate] DATABASE_URL not set. Skipping migration.');
    process.exit(0);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE vault_identities
      ADD COLUMN IF NOT EXISTS password_cipher TEXT DEFAULT '';
    `);

    const result = await client.query(`
      UPDATE vault_identities
      SET password_cipher = ''
      WHERE password_cipher IS NULL;
    `);

    await client.query('COMMIT');
    console.log(`[migrate] vault_identities.password_cipher backfilled. Updated rows: ${result.rowCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[migrate] Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

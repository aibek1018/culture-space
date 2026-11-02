/**
 * Recreates the database named by DATABASE_URL.
 * Refuses the development database, the integration-test database, and
 * PostgreSQL maintenance databases.
 */
const { Client } = require('pg');

const protectedNames = new Set([
  'culturespace',
  'culturespace_test',
  'postgres',
  'template0',
  'template1',
]);

async function main() {
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const target = new URL(targetUrl);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[a-z0-9_]+$/.test(databaseName)) {
    throw new Error(
      'Disposable database name must be lowercase letters, digits, or underscores',
    );
  }
  if (protectedNames.has(databaseName)) {
    throw new Error(`Refusing to recreate protected database ${databaseName}`);
  }

  const admin = new URL(targetUrl);
  admin.pathname = '/culturespace';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await client.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Could not prepare the database'}\n`,
  );
  process.exit(1);
});

const { Client } = require('pg');

module.exports = async function globalSetup() {
  const base =
    process.env.DATABASE_URL ||
    'postgresql://culturespace:culturespace@127.0.0.1:5432/culturespace';
  const adminUrl = new URL(base);
  adminUrl.pathname = '/culturespace';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    ['culturespace_test'],
  );
  if (existing.rowCount === 0) {
    await client.query('CREATE DATABASE culturespace_test');
  }
  await client.end();
};

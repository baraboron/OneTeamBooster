import pg from '../../backend/node_modules/pg/lib/index.js';
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  const client = new pg.Client({connectionString: process.env.TEST_DATABASE_URL});
  try { await client.connect(); await client.query('SELECT 1'); ready = true; }
  catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  finally { await client.end().catch(() => {}); }
  if (ready) break;
}
if (!ready) throw new Error('Disposable test database did not become ready');

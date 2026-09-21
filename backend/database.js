import pg from 'pg';
import { readFile } from 'node:fs/promises';

export function createPool(connectionString = process.env.DATABASE_URL, { testMode = false } = {}) {
  if (!connectionString && !process.env.PGHOST) throw new Error('DATABASE_NOT_CONFIGURED');
  return new pg.Pool({ connectionString, ...(testMode?{options:'-c search_path=otb_preview'}:{}), max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000, idle_in_transaction_session_timeout: 10000 });
}
export async function transaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function migrate(pool, { testMode = false } = {}) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(72180341)');
    if(testMode) {
      await db.query('CREATE SCHEMA IF NOT EXISTS otb_preview');
      const {rows:[scope]}=await db.query('SELECT current_schema() AS name');
      if(scope.name!=='otb_preview') throw new Error('TEST_SCHEMA_REQUIRED');
    }
    await db.query(sql);
  });
}
export async function syncDirectory(pool, hrClient) {
  // Fetch and validate every page before changing the existing directory.
  const employees = await hrClient.all();
  if (!employees.length) throw new Error('HR_EMPTY_SYNC_REFUSED');
  await transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(72180342)');
    await db.query('UPDATE employees SET active=false WHERE active');
    for (const employee of employees) {
      await db.query(`INSERT INTO employees(user_id,profile) VALUES($1,$2::jsonb)
        ON CONFLICT(user_id) DO UPDATE SET profile=EXCLUDED.profile,active=true,updated_at=now()`, [employee.USER_ID, JSON.stringify(employee)]);
    }
    await db.query('INSERT INTO directory_state VALUES(1,now(),$1) ON CONFLICT(id) DO UPDATE SET synced_at=now(),employee_count=EXCLUDED.employee_count', [employees.length]);
  });
  return { count: employees.length };
}

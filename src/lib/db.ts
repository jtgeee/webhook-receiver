import { Pool, PoolClient } from 'pg';

let db: Pool | undefined;
let dbReady: Promise<void>;

function initialiseDatabase() {
  dbReady = (async () => {
    db = new Pool({ connectionString: process.env.DATABASE_URL });
  })();
}

initialiseDatabase();

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  await dbReady;
  const client: PoolClient = await db!.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

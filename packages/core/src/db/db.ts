import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'
import { serverEnv } from '../env.js'
import { logger } from '../logger.js'

const pool = new Pool({
  connectionString: serverEnv.DATABASE_URL,
  max: 10,                       // Maximal 10 Verbindungen zeitgleich
  min: 3,                        // 3 Verbindungen immer offen halten
  idleTimeoutMillis: 30000,      // Ungenutzte Verbindungen nach 30 Sek schließen
  connectionTimeoutMillis: 5000, // Nach 5 Sek Verbindungsversuch abbrechen
  maxUses: 5000,
});

pool.on('error', (err) => {
  logger.error(err, 'Schwerwiegender Pool-Fehler');
});

export const db = drizzle({ 
  client: pool, 
  ...schema 
});
'use strict';

// node-postgres lets SSL query parameters in DATABASE_URL replace the explicit
// `ssl` object supplied by our Pool configuration. Supabase pooler URLs may
// include sslmode=require, which can therefore re-enable certificate-chain
// verification even though the application intentionally supplies
// { rejectUnauthorized: false } for this managed encrypted connection.
//
// Remove only SSL-mode query parameters before loading the server. The Pool
// still enables TLS explicitly in store.js and knowledge.js. Credentials,
// host, database, and every non-SSL query parameter are preserved.
function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
}

require('../server.js');

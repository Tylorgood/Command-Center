'use strict';

// Normalize the Supabase connection before node-postgres parses it.
// 1) Keep TLS enabled by the Pool config in store.js/knowledge.js, while
//    removing URL SSL flags that can override that explicit config.
// 2) Shared Supabase poolers require postgres.<project-ref> as the username.
//    Direct db.<ref>.supabase.co connections continue to use plain postgres.
function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }

    const projectRef = String(process.env.SUPABASE_PROJECT_REF || '').trim();
    const sharedPooler = /\.pooler\.supabase\.com$/i.test(url.hostname);
    if (sharedPooler && projectRef && url.username === 'postgres') {
      url.username = `postgres.${projectRef}`;
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

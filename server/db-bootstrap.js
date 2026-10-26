'use strict';

const V4_SUPABASE_PROJECT_REF = 'xnvvrksunlgkcexpqoan';

// Normalize the V4 staging database URL before node-postgres parses it.
// Shared Supabase poolers require postgres.<project-ref> as the username.
// Direct db.<ref>.supabase.co connections continue to use plain postgres.
// URL SSL flags are removed because store.js/knowledge.js explicitly enable TLS.
function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }

    const projectRef = String(process.env.SUPABASE_PROJECT_REF || V4_SUPABASE_PROJECT_REF).trim();
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

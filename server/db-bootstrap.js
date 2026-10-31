'use strict';

const V4_SUPABASE_PROJECT_REF = 'xnvvrksunlgkcexpqoan';
function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
    const projectRef = String(process.env.SUPABASE_PROJECT_REF || V4_SUPABASE_PROJECT_REF).trim();
    const sharedPooler = /\.pooler\.supabase\.com$/i.test(url.hostname);
    if (sharedPooler && projectRef && url.username === 'postgres') url.username = `postgres.${projectRef}`;
    return url.toString();
  } catch { return raw; }
}
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
  try {
    const target = new URL(process.env.DATABASE_URL);
    console.log('database target',{host:target.hostname,port:target.port||'5432',database:target.pathname.replace(/^\//,'')||'postgres',user:decodeURIComponent(target.username),tls:process.env.PGSSLMODE==='disable'?'disabled':'enabled'});
  } catch { console.log('database target configured (details unavailable)'); }
  const pg=require('pg'),BasePool=pg.Pool;
  class JarvisPool extends BasePool { constructor(config={}) { super({...config,max:1,min:0,idleTimeoutMillis:10000,connectionTimeoutMillis:10000}); } }
  pg.Pool=JarvisPool;
} else console.log('database target missing');

require('./sensory-http-hook');
require('./location-context-hook');
require('./dashboard-sensory-overlay');
require('../server.js');

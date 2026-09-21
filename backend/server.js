import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { AppError } from './domain.js';

const capabilities = Object.freeze({
  authentication: false,
  organizationAuthorization: false,
  boosterDelivery: false,
  replies: false,
  pointsLedger: false,
  companyLeaderboard: false,
  aiGeneration: false,
  persistence: false
});

function respond(req, res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(req.method === 'HEAD' ? undefined : payload);
}

export function createServer({ application } = {}) {
  let draining = false;
  const server = http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    try {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return respond(req, res, 400, { error: { code: 'BAD_REQUEST' } }); }

    if (['/healthz', '/readyz', '/api/system'].includes(pathname)) {
      if (!['GET', 'HEAD'].includes(req.method)) {
        return respond(req, res, 405, { error: { code: 'METHOD_NOT_ALLOWED' } }, { Allow: 'GET, HEAD' });
      }
      if (pathname === '/healthz') return respond(req, res, 200, { status: 'ok' });
      if (pathname === '/readyz') {
        const ready = !draining && (!application || await application.ready());
        return respond(req, res, ready ? 200 : 503, { status: ready ? 'ready' : 'unavailable', scope: application ? 'database-directory' : 'scaffold-http' });
      }
      return respond(req, res, 200, {
        service: 'oneteambooster-api', version: '0.2.0', mode: application ? 'preview' : 'scaffold',
        productionReady: false, capabilities,
        implemented: { hrDirectory: true, boosterDelivery: true, replies: true, pointsLedger: true, leaderScope: true, companyLeaderboard: true },
        authentication: 'deferred', businessApiAccess: application?.testMode?'test-users-only':'disabled-until-authentication',
        testUserMode: application?.testMode===true,
        employeeSearch: application?.testMode?'test-users':application?.previewEmployeeSearch ? 'preview-read-only' : 'requires-authentication'
      });
    }

    // Fail closed: never return fake employees, points or a successful write.
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      if(application)return await application.handle(req,pathname,(status,body,headers)=>respond(req,res,status,body,headers));
      return respond(req, res, 503, {
        error: { code: 'BACKEND_NOT_CONFIGURED', message: '로그인·권한·DB 연결이 아직 준비되지 않았습니다.' }
      });
    }
    return respond(req, res, 404, { error: { code: 'NOT_FOUND' } });
    } catch(error) {
      if(res.headersSent){res.end();return;}
      const known=error instanceof AppError;
      return respond(req,res,known?error.status:503,{error:{code:known?error.code:'SERVICE_UNAVAILABLE',message:known?error.message:'잠시 후 다시 시도해 주세요.'}});
    }
  });
  server.keepAliveTimeout = 5000;
  server.beginDrain = () => { draining = true; };
  return server;
}

export function readPort(value = '3000') {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return Number(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let application, pool, syncTimer;
  if(process.env.PGHOST || process.env.DATABASE_URL){
    try {
      const database=await import('./database.js');
      const {createHrClient}=await import('./hr-client.js');
      const {createApplication}=await import('./application.js');
      const testMode=process.env.TEST_USER_MODE==='true';
      pool=database.createPool(undefined,{testMode});
      await database.migrate(pool,{testMode});
      const hr=createHrClient({apiKey:process.env.DATA_API_KEY,baseUrl:process.env.DATA_API_URL});
      await database.syncDirectory(pool,hr);
      application=createApplication({pool,campaign:process.env.CAMPAIGN_ID || '2026-OneTeam',previewEmployeeSearch:process.env.PREVIEW_EMPLOYEE_SEARCH==='true',testMode,previewOrigin:process.env.PREVIEW_ORIGIN});
      if(testMode) await (await import('./test-users.js')).testUsers(pool);
      let syncing=false;
      syncTimer=setInterval(async()=>{
        if(syncing)return;syncing=true;
        try{await database.syncDirectory(pool,hr);}catch{console.error('HR_SYNC_FAILED');}finally{syncing=false;}
      },3600000);
      syncTimer.unref();
    } catch { console.error('BACKEND_INITIALIZATION_FAILED');await pool?.end();process.exit(1); }
  }
  const server = createServer({application});
  server.listen(readPort(process.env.PORT), '0.0.0.0', () => {
    console.log('OneTeamBooster listening; login deferred and business APIs protected.');
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.beginDrain();
    clearInterval(syncTimer);
    server.close(async () => {await pool?.end();process.exit(0);});
    setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

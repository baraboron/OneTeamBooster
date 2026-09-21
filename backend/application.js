import { AppError, sendBooster, replyBooster, workspace, leaderboard, leaderView } from './domain.js';
import { searchEmployees, listDepartments } from './directory.js';
import { testUsers, testIdentity } from './test-users.js';

export async function readJson(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new AppError(415,'JSON_REQUIRED');
  let bytes = 0;
  const chunks=[];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes>16384) throw new AppError(413,'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new AppError(400,'INVALID_JSON'); }
}

export function createApplication({ pool, campaign = '2026-OneTeam', authorize, previewEmployeeSearch = false, testMode = false, previewOrigin = '', draftGenerator }) {
  if(testMode) {
    if(authorize || !/^https?:\/\//.test(previewOrigin) || new URL(previewOrigin).origin!==previewOrigin) throw new Error('INVALID_TEST_CONFIGURATION');
    campaign='TEST-2026-OneTeam';
  }
  // Only a future server-verified identity adapter may provide authorize.
  // The deployed entry point never supplies one while login is deferred.
  async function ready() {
    const { rows: [state] }=await pool.query("SELECT synced_at > now()-interval '24 hours' AS fresh FROM directory_state WHERE id=1");
    return state?.fresh === true;
  }
  return { ready, previewEmployeeSearch, testMode, aiGeneration:Boolean(draftGenerator?.enabled), async handle(req, path, send) {
    const url = new URL(req.url,'http://localhost');
    if(testMode && path==='/api/test-users' && req.method==='GET') {
      if(!await ready()) throw new AppError(503,'DIRECTORY_NOT_READY');
      return send(200,{mode:'test',data:await testUsers(pool)});
    }
    // Explicit deployment opt-in covers directory reads only; never business writes or identity.
    if(previewEmployeeSearch && !testMode && !authorize && req.method==='GET' && ['/api/employees','/api/departments'].includes(path)) {
      if(!await ready()) throw new AppError(503,'DIRECTORY_NOT_READY','인사정보 연결 상태를 확인 중입니다.');
      return send(200,path==='/api/employees'?await searchEmployees(pool,url.searchParams):await listDepartments(pool));
    }
    if (!authorize && !testMode) throw new AppError(401,'AUTH_NOT_CONFIGURED','로그인 연결 후 사용할 수 있습니다. 현재 화면은 시연용입니다.');
    if (!await ready()) throw new AppError(503,'DIRECTORY_NOT_READY','인사정보 연결 상태를 확인 중입니다.');
    const identity=testMode?await testIdentity(pool,req,previewOrigin):await authorize(req);
    const {rows:[actor]}=await pool.query('SELECT user_id,profile FROM employees WHERE user_id=$1 AND active',[identity.userId]);
    if(!actor)throw new AppError(403,'INACTIVE_EMPLOYEE');
    if(path==='/api/drafts' && req.method==='POST'){
      if(!draftGenerator?.enabled)throw new AppError(503,'AI_NOT_CONFIGURED','AI 초안 연결을 준비 중입니다.');
      return send(200,await draftGenerator.generate(actor.user_id,await readJson(req)));
    }
    if(path==='/api/me' && req.method==='GET')return send(200,{employee:actor.profile});
    if (req.method === 'GET' && path === '/api/employees') {
      return send(200,await searchEmployees(pool,url.searchParams,actor.user_id));
    }
    if(req.method==='GET' && path==='/api/departments') return send(200,await listDepartments(pool));
    if(req.method==='GET' && path==='/api/workspace') return send(200,{...await workspace(pool,actor.user_id,campaign),...(testMode?{mode:'test',employee:actor.profile}:{})});
    if(req.method==='GET' && path==='/api/leaderboard') {
      const result=await leaderboard(pool,campaign);
      return send(200,testMode?{...result,scope:'test',mode:'test',periodLabel:'테스트 포인트 누적'}:result);
    }
    if(testMode && path.startsWith('/api/leader/')) throw new AppError(403,'LEADER_FORBIDDEN','테스트 사용자에게 리더 권한을 부여하지 않았습니다.');
    if(req.method==='GET' && path==='/api/leader/records') return send(200,await leaderView(pool,actor.user_id,campaign,url.searchParams.get('memberId')||null,url.searchParams.get('direction')||'received'));
    if(req.method==='POST' && path==='/api/boosters') return send(201,await sendBooster(pool,actor.user_id,await readJson(req),req.headers['idempotency-key'],campaign));
    const replyPath=path.match(/^\/api\/boosters\/([^/]+)\/reply$/);
    if(req.method==='POST' && replyPath) return send(200,await replyBooster(pool,actor.user_id,replyPath[1],(await readJson(req)).message));
    throw new AppError(404,'NOT_FOUND');
  }};
}

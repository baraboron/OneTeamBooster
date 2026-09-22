import { createHash, randomUUID } from 'node:crypto';
import { transaction } from './database.js';

export class AppError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
export const OPTIONS = Object.freeze({
  partner: ['동료','상사 / 선배','후배 / 신입','프로젝트 참여원 / 팀 전체'],
  recipientScope: ['같은팀','타팀'],
  missions: ['고객 대응','성능 개선','설비 셋업','문서 작성','평가 및 분석','프로세스 개선','안전환경 점검'],
  boosts: ['적극적 경청','피드백 수용','책임감(R&R)','유연성','공동 목표 의식','정보 공유','동료 지지'],
  impacts: ['일정 단축','품질 향상','리스크 방지','비용 절감','팀워크 강화','시야 확장','동기 부여']
});
export function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError(400,'INVALID_INPUT',`${field} 항목을 확인해 주세요.`);
  return value.trim();
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError(400,'INVALID_REQUEST_ID');
  return value;
}
export function validateRecipientScope(value) {
  if (value === undefined || value === null) return undefined;
  if (!OPTIONS.recipientScope.includes(value)) throw new AppError(400,'INVALID_RECIPIENT_SCOPE','같은 팀/그룹 또는 타 팀/그룹을 선택해 주세요.');
  return value;
}
export function validateBooster(input) {
  const result = { recipientId: text(input.recipientId,100,'수신자'), projectName: text(input.projectName,100,'업무명'), partner: input.partner };
  if (!OPTIONS.partner.includes(result.partner)) throw new AppError(400,'INVALID_PARTNER');
  for (const field of ['missions','boosts','impacts']) {
    const values = input[field];
    if (!Array.isArray(values) || values.length < 1 || values.length > 3 || new Set(values).size !== values.length || values.some(value => !OPTIONS[field].includes(value))) throw new AppError(400,'INVALID_SELECTION');
    result[field] = values;
  }
  result.message = text(input.message,2000,'칭찬 내용');
  const recipientScope = validateRecipientScope(input.recipientScope);
  if (recipientScope !== undefined) result.recipientScope = recipientScope;
  return result;
}

export async function sendBooster(pool, actorId, input, requestId, campaign) {
  const value = validateBooster(input); uuid(requestId);
  if (actorId === value.recipientId) throw new AppError(400,'SELF_SEND','본인에게는 칭찬을 보낼 수 없습니다.');
  const hash = createHash('sha256').update(JSON.stringify({ ...value, campaign })).digest('hex');
  return transaction(pool, async db => {
    // Serialize sends by sender across every replica; counters and awards share the transaction.
    const actor = await db.query('SELECT user_id FROM employees WHERE user_id=$1 AND active FOR UPDATE', [actorId]);
    if (!actor.rowCount) throw new AppError(403,'INACTIVE_EMPLOYEE');
    const previous = await db.query('SELECT id,request_hash FROM boosters WHERE sender_id=$1 AND request_id=$2', [actorId,requestId]);
    if (previous.rowCount) {
      if (previous.rows[0].request_hash !== hash) throw new AppError(409,'IDEMPOTENCY_CONFLICT');
      return { id: previous.rows[0].id, replayed: true };
    }
    if (!(await db.query('SELECT user_id FROM employees WHERE user_id=$1 AND active', [value.recipientId])).rowCount) throw new AppError(400,'UNKNOWN_RECIPIENT');
    const { rows: [limits] } = await db.query(`SELECT
      count(*) FILTER (WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')::int AS daily,
      count(*) FILTER (WHERE recipient_id=$2 AND created_at >= date_trunc('week',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')::int AS weekly
      FROM boosters WHERE sender_id=$1`, [actorId,value.recipientId]);
    if (limits.daily >= 3) throw new AppError(409,'DAILY_LIMIT','오늘은 부스터를 3회 모두 보냈어요.');
    if (limits.weekly) throw new AppError(409,'WEEKLY_LIMIT','같은 동료에게는 월요일 기준 주 1회만 보낼 수 있습니다.');
    const id = randomUUID();
    await db.query(`INSERT INTO boosters(id,campaign,sender_id,recipient_id,project_name,partner,missions,boosts,impacts,message,request_id,request_hash,recipient_scope)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13)`, [id,campaign,actorId,value.recipientId,value.projectName,value.partner,JSON.stringify(value.missions),JSON.stringify(value.boosts),JSON.stringify(value.impacts),value.message,requestId,hash,value.recipientScope??null]);
    await db.query(`INSERT INTO point_entries(campaign,user_id,booster_id,kind,points) VALUES($1,$2,$4,'send',10),($1,$3,$4,'receive',20)`, [campaign,actorId,value.recipientId,id]);
    return { id, replayed: false };
  });
}

export async function replyBooster(pool, actorId, boosterId, message) {
  uuid(boosterId); message = text(message,1000,'답장');
  return transaction(pool, async db => {
    const { rows: [booster] } = await db.query('SELECT * FROM boosters WHERE id=$1 FOR UPDATE', [boosterId]);
    if (!booster || booster.recipient_id !== actorId) throw new AppError(404,'BOOSTER_NOT_FOUND');
    const previous = await db.query('SELECT message FROM replies WHERE booster_id=$1', [boosterId]);
    if (previous.rowCount) {
      if (previous.rows[0].message !== message) throw new AppError(409,'ALREADY_REPLIED');
      return { id: boosterId, replayed: true };
    }
    await db.query('INSERT INTO replies(booster_id,message) VALUES($1,$2)', [boosterId,message]);
    await db.query(`INSERT INTO point_entries(campaign,user_id,booster_id,kind,points) VALUES($1,$2,$3,'reply',5)`, [booster.campaign,actorId,boosterId]);
    return { id: boosterId, replayed: false };
  });
}

const joinedRecords = `SELECT b.*,s.profile AS sender,r.profile AS recipient,reply.message AS reply_message,reply.created_at AS reply_at
  FROM boosters b JOIN employees s ON s.user_id=b.sender_id JOIN employees r ON r.user_id=b.recipient_id LEFT JOIN replies reply ON reply.booster_id=b.id`;
export function presentRecord(row) {
  return {
    id: row.id, senderId: row.sender_id, recipientId: row.recipient_id,
    from: row.sender.USER_NM, team: row.sender.DEPT_NM, recipient: row.recipient.USER_NM,
    recipientTeam: row.recipient.DEPT_NM, projectName: row.project_name, partner: row.partner,
    recipientScope: row.recipient_scope ?? null,
    missions: row.missions, boosts: row.boosts, impacts: row.impacts,
    mission: row.missions.join(' · '), boost: row.boosts[0], impact: row.impacts[0], message: row.message,
    time: row.created_at.toISOString(), sentAt: row.created_at.getTime(), replied: Boolean(row.reply_at),
    replyText: row.reply_message || '', recipientReply: row.reply_message || '', recipientReplyAt: row.reply_at?.toISOString() || '',
    replyPointsAwarded: Boolean(row.reply_at), isDemo: false
  };
}
export async function workspace(pool, userId, campaign) {
  const records = await pool.query(`${joinedRecords} WHERE b.campaign=$2 AND (b.sender_id=$1 OR b.recipient_id=$1) ORDER BY b.created_at DESC`, [userId,campaign]);
  const { rows: [balance] } = await pool.query('SELECT COALESCE(sum(points),0)::int AS points FROM point_entries WHERE user_id=$1 AND campaign=$2', [userId,campaign]);
  const { rows: [limits] } = await pool.query(`SELECT count(*) FILTER (WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')::int AS daily,
    COALESCE(array_agg(DISTINCT recipient_id) FILTER (WHERE created_at >= date_trunc('week',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'),'{}') AS weekly FROM boosters WHERE sender_id=$1`, [userId]);
  return {
    points: balance.points, received: records.rows.filter(row => row.recipient_id === userId).map(presentRecord),
    sentBoosters: records.rows.filter(row => row.sender_id === userId).map(presentRecord),
    remainingToday: Math.max(0,3-limits.daily), weeklyRecipientIds: limits.weekly
  };
}
export async function leaderboard(pool, campaign) {
  const { rows } = await pool.query(`WITH totals AS (
    SELECT p.user_id,sum(p.points)::int AS points,max(p.created_at) AS as_of FROM point_entries p JOIN employees e ON e.user_id=p.user_id AND e.active WHERE campaign=$1 GROUP BY p.user_id
  ), ranked AS (SELECT *,rank() OVER (ORDER BY points DESC)::int AS rank FROM totals)
  SELECT ranked.*,e.profile FROM ranked JOIN employees e ON e.user_id=ranked.user_id WHERE rank<=10 ORDER BY points DESC,ranked.user_id`, [campaign]);
  // Aggregation runs at query time against the durable ledger, including the valid empty case.
  const { rows: [clock] } = await pool.query('SELECT now() AS as_of');
  return { scope: 'company', mode: 'live', periodLabel: `${campaign} 캠페인 누적`, asOf: clock.as_of.toISOString(),
    leaders: rows.map(row => ({ userId: row.user_id, displayName: row.profile.USER_NM, groupName: row.profile.DEPT_NM, points: row.points, rank: row.rank })) };
}
export async function leaderView(pool, userId, campaign, memberId, direction='received') {
  const { rows: scopeRows } = await pool.query('SELECT dept_cd FROM leader_scopes WHERE leader_id=$1', [userId]);
  const scopes = scopeRows.map(row => row.dept_cd);
  if (!scopes.length) throw new AppError(403,'LEADER_FORBIDDEN','담당 부서 조회 권한이 없습니다.');
  if (!['received','sent'].includes(direction)) throw new AppError(400,'INVALID_DIRECTION');
  const { rows: employees } = await pool.query(`SELECT user_id,profile FROM employees WHERE active AND profile->>'DEPT_CD'=ANY($1::text[]) ORDER BY profile->>'USER_NM',user_id`, [scopes]);
  const ids = employees.map(row => row.user_id);
  if (memberId && !ids.includes(memberId)) throw new AppError(403,'MEMBER_OUT_OF_SCOPE');
  const { rows: records } = await pool.query(`${joinedRecords} WHERE b.campaign=$2 AND (b.recipient_id=ANY($1::text[]) OR b.sender_id=ANY($1::text[])) ORDER BY b.created_at DESC`, [ids,campaign]);
  const filterIds = memberId ? [memberId] : ids;
  return { scopes, members: employees.map(row => ({ USER_ID: row.user_id, USER_NM: row.profile.USER_NM, DEPT_CD: row.profile.DEPT_CD, DEPT_NM: row.profile.DEPT_NM,
      received: records.filter(record => record.recipient_id===row.user_id).length, sent: records.filter(record => record.sender_id===row.user_id).length })),
    records: records.filter(row => filterIds.includes(direction==='received'?row.recipient_id:row.sender_id)).map(presentRecord) };
}

export async function hasAdminAccess(pool, userId) {
  const result = await pool.query('SELECT 1 FROM administrator_grants WHERE user_id=$1', [userId]);
  return result.rowCount > 0;
}

export async function adminHistory(pool, userId, campaign, searchParams) {
  if (!await hasAdminAccess(pool,userId)) throw new AppError(403,'ADMIN_FORBIDDEN','관리자 권한이 없습니다.');
  const selectedUser = String(searchParams.get('userId') || '').trim();
  const direction = String(searchParams.get('direction') || 'all');
  const query = String(searchParams.get('q') || '').trim();
  const page = Number(searchParams.get('page') || 1);
  if (selectedUser.length > 100 || query.length > 50 || !['all','received','sent'].includes(direction) || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new AppError(400,'INVALID_ADMIN_FILTER','필터 조건을 확인해 주세요.');
  }
  if (direction !== 'all' && !selectedUser) throw new AppError(400,'ADMIN_USER_REQUIRED','받은/보낸 구분을 사용하려면 사용자를 선택해 주세요.');
  if (selectedUser && !(await pool.query('SELECT 1 FROM employees WHERE active AND user_id=$1',[selectedUser])).rowCount) {
    throw new AppError(400,'UNKNOWN_ADMIN_FILTER_USER','선택한 사용자를 확인해 주세요.');
  }
  const values=[campaign];
  const conditions=['b.campaign=$1'];
  if (selectedUser) {
    values.push(selectedUser);
    const parameter='$'+values.length;
    conditions.push(direction==='received'?`b.recipient_id=${parameter}`:direction==='sent'?`b.sender_id=${parameter}`:`(b.sender_id=${parameter} OR b.recipient_id=${parameter})`);
  }
  if (query) {
    values.push('%'+query.replaceAll('\\','\\\\').replaceAll('%','\\%').replaceAll('_','\\_')+'%');
    const parameter='$'+values.length;
    conditions.push(`(s.profile->>'USER_NM' ILIKE ${parameter} ESCAPE '\\' OR r.profile->>'USER_NM' ILIKE ${parameter} ESCAPE '\\' OR s.profile->>'DEPT_NM' ILIKE ${parameter} ESCAPE '\\' OR r.profile->>'DEPT_NM' ILIKE ${parameter} ESCAPE '\\' OR b.project_name ILIKE ${parameter} ESCAPE '\\' OR b.message ILIKE ${parameter} ESCAPE '\\')`);
  }
  const where=conditions.join(' AND ');
  const {rows:[count]}=await pool.query(`SELECT count(*)::int AS total FROM boosters b JOIN employees s ON s.user_id=b.sender_id JOIN employees r ON r.user_id=b.recipient_id WHERE ${where}`,[...values]);
  const recordValues=[...values,50,(page-1)*50];
  const {rows}=await pool.query(`${joinedRecords} WHERE ${where} ORDER BY b.created_at DESC LIMIT $${recordValues.length-1} OFFSET $${recordValues.length}`,recordValues);
  const {rows:employees}=await pool.query(`SELECT user_id,profile FROM employees WHERE active ORDER BY profile->>'USER_NM',profile->>'DEPT_NM',user_id`);
  return {
    total:count.total,page,totalPages:Math.ceil(count.total/50),
    users:employees.map(row=>({USER_ID:row.user_id,USER_NM:row.profile.USER_NM,DEPT_NM:row.profile.DEPT_NM})),
    records:rows.map(presentRecord)
  };
}

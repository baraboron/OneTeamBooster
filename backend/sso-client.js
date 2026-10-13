import { AppError } from './domain.js';

function cookieValue(header, name) {
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return '';
}

export function createSsoAuthorizer({ baseUrl = process.env.SSO_INTERNAL_URL, fetchImpl = globalThis.fetch } = {}) {
  let endpoint;
  try {
    endpoint = new URL('/sso/auth/me', baseUrl);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error();
  } catch {
    throw new Error('INVALID_SSO_INTERNAL_URL');
  }

  return async function authorize(req) {
    const sessionId = cookieValue(req.headers.cookie, 'otb_session');
    if (!sessionId) throw new AppError(401, 'LOGIN_REQUIRED', '사내 SSO 로그인이 필요합니다.');
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: { Cookie: `otb_session=${sessionId}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      throw new AppError(503, 'AUTH_SERVICE_UNAVAILABLE', '로그인 확인 서비스에 연결할 수 없습니다.');
    }
    if (response.status === 401) throw new AppError(401, 'LOGIN_REQUIRED', '사내 SSO 로그인이 필요합니다.');
    if (!response.ok) throw new AppError(503, 'AUTH_SERVICE_UNAVAILABLE', '로그인 확인 서비스에 연결할 수 없습니다.');
    let profile;
    try { profile = await response.json(); }
    catch { throw new AppError(503, 'AUTH_SERVICE_UNAVAILABLE', '로그인 정보를 확인할 수 없습니다.'); }
    if (typeof profile.user_id !== 'string' || !profile.user_id || typeof profile.csrf_token !== 'string' || !profile.csrf_token) {
      throw new AppError(401, 'LOGIN_REQUIRED', '사내 SSO 로그인이 필요합니다.');
    }
    return { userId: profile.user_id, csrfToken: profile.csrf_token };
  };
}

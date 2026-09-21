# 인사 연동 및 업무 API

## 2026-09-21 소속 구분 및 어투 · 로컬 반영

- `recipientScope`는 `같은팀` 또는 `타팀`이며 화면에는 같은 팀/그룹·타 팀/그룹으로 표시한다. 사용자가 선택하는 분류이며 인사정보에서 추정하지 않는다.
- `/api/drafts`와 `/api/boosters`가 선택값을 검증하고, `boosters.recipient_scope`에 저장해 수신함·발신함·재사용에 전달한다. DB 컬럼은 nullable로 추가하며 기존 기록·요청의 중복 방지 해시는 유지한다. 기존 클라이언트의 미입력은 허용하지만 새 작성 UI에서는 선택이 필수다.
- 프롬프트 `praise-ko-v2`는 관계 3종 × 소속 2종의 어투·친밀도를 반영한다. 게이트웨이와 앱의 버전을 함께 배포해야 하며, 이번 변경은 아직 배포하지 않았다.

## 2026-09-21 AI 게이트웨이 연결

인증된 테스트 사용자의 `POST /api/drafts`를 Supabase `openai-gateway`로 전달한다. `OPENAI_GATEWAY_URL`과 `OTB_GATEWAY_TOKEN`으로 호출하며 OpenAI API 키는 사내 서버에 두지 않는다. 요청은 업무명·관계·선택값만 전달하고 성공 시 `{message,source,model,promptVersion}`을 반환한다. 초안 생성은 원장에 쓰지 않는다. 실제 모델 생성·브라우저 수정 화면·기록 불변까지 배포 검증했다. 상세 설정은 `deploy/OPENAI_GATEWAY.md` 참고. 아래의 AI 미연결·템플릿 관련 설명은 게이트웨이 배포 이전 이력이다.

## 테스트 사용자 모드

사용자 요청으로 `TEST_USER_MODE=true`, `PREVIEW_ORIGIN=http://192.168.20.72:30081`일 때 송재현·김영훈을 선택해 테스트할 수 있도록 구현했다. 실제 로그인 인증 기능이 아니다. `GET /api/test-users`에서 두 사용자의 `USER_ID`, `USER_NM`, `DEPT_CD`, `DEPT_NM`, `ROLE_NM`을 받고, 나머지 요청에는 선택한 `X-OTB-Test-User` 헤더를 보낸다. 서버는 현재 HR 디렉터리의 두 이름이 각각 유일한 경우만 허용한다.

전송/답장 POST는 설정된 Origin과 일치해야 하며 cross-site 요청을 차단한다. 헤더를 운영 인증으로 사용하지 않는다. 테스트 사용자 이름을 선택할 수 있는 모든 접속자가 이 두 사람의 테스트 기록을 조회·작성할 수 있다. 서버 원본 인사 API 키는 브라우저로 전달하지 않는다.

테스트 서버는 `search_path=otb_preview`인 별도 PostgreSQL 연결을 사용하고 그 스키마에 디렉터리·칭찬·답장·포인트를 저장한다. public 원장과 발송 한도는 분리된다. `/api/workspace`는 `mode:test`와 선택한 `employee`를 포함하며, `/api/leaderboard`는 `scope:test`, `mode:test`를 반환한다. 리더 조회는 403이다. 프런트엔드는 테스트 사용자 ID만 탭 세션에 기억하고 인사/칭찬 기록을 LocalStorage에 저장하지 않는다.

배포 기본값은 `testUserMode:false`다. `deploy/values-preview.yaml`의 true 설정은 사용자 승인 후 2026-09-21 Helm 리비전 3에 적용했다. 테스트 모드를 끄면 기존 인증 없는 업무 API 차단이 적용된다.

## 2026-09-21 검색 확장

`GET /api/employees?q=검색어&page=1&DEPT_CD=부서코드`는 이름·ID·부서·이메일·직책을 부분 검색한다. 검색어는 2~50자, 페이지당 20명이며 `%`, `_`는 일반 문자로 검색한다. 응답은 `data`, `count`, `total`, `page`, `pageSize`, `totalPages`, `hasMore`다. 직원의 대문자 원본 필드를 보존하며 `INSERT_DT`를 추가했다.

`GET /api/departments`는 `data: [{DEPT_CD, DEPT_NM, count}]`와 부서 수 `count`를 반환한다. 인증된 검색은 본인을 제외하며, 부서 필터와 이름/ID 순 정렬은 서버에서 처리한다.

기본 설정은 아래의 인증 차단과 같다. 별도 동의한 사내 검색 시연에 한해 서버 환경변수 `PREVIEW_EMPLOYEE_SEARCH=true`(Helm `backend.previewEmployeeSearch: true`)로 위 두 GET 경로만 허용할 수 있다. 이 설정은 로그인·리더 권한·쓰기 기능을 제공하지 않는다. 최신 동기화가 24시간을 넘으면 검색도 503으로 중단한다. 현재 프리뷰 값 파일에는 활성화하지 않았다.

프런트엔드는 검색 결과를 메모리에서 선택해 초안을 만든다. 실제 직원 초안은 전송하거나 LocalStorage에 저장하지 않으며 닫을 때 지운다. 기본 상태에서 실제 직원 조회는 401 안내가 표시된다.

로그인은 사용자 요청으로 보류했다. 실제 배포에서는 `authorize` 구현을 주입하지 않으므로 `/api/system` 외 모든 업무 API가 **401 AUTH_NOT_CONFIGURED**로 응답한다. 직원 ID/역할 헤더나 쿠키만으로 접근할 수 없다. 공개 UI는 기존 LocalStorage 시연이다.

## 구현한 기능

- `hr-client.js`: 사내 `/api/gateway/common/hr-user` POST, 서버 환경변수 `DATA_API_KEY`, 최대 1,000건씩 페이지 전체 수집, 총건수·중복·일관성 검사, redirect 거부, 타임아웃과 오류 비밀값 제거.
- `database.js`, `schema.sql`: PostgreSQL에 직원 디렉터리·칭찬·답장·포인트 원장·리더 담당 부서 저장. 새 전체 목록 검증 후 한 트랜잭션으로 디렉터리 교체. 실패/빈 목록은 기존 자료를 지우지 않는다.
- `domain.js`: 검증된 발신자 ID, 선택 배열 검증, 수신자 존재 검증, 서버 시간(Asia/Seoul) 하루 3회/같은 수신자 월요일 기준 주 1회, 요청 ID 재시도 방지, 트랜잭션과 고유 제약을 통한 포인트 중복 방지.
- 발신 10P, 수신 20P, 답장자 5P만 지급한다. 답장은 해당 수신자만 가능하며 발신자에게 추가 포인트를 주지 않는다.
- 리더는 명시적으로 등록한 `leader_scopes`의 현재 부서 구성원 기록만 조회한다. 직책 코드/명칭은 권한 근거로 사용하지 않는다.
- 순위는 현재 캠페인의 서버 원장을 집계하며 동점을 공동 순위로 처리하고 공동 10위까지 포함한다. `asOf`는 요청에서 실제 집계한 시각이다.
- `api-client.js`는 향후 인증된 UI 연결용 클라이언트다. 현재 시연 화면은 이 클라이언트로 실제 직원/업무 API를 호출하지 않는다.

인사 API의 원래 필드명 `USER_ID`, `USER_NM`, `USER_EMAIL`, `ROLE_CD`, `ROLE_NM`, `DEPT_CD`, `DEPT_NM`을 유지한다. 2026-09-18 실제 조회는 1,504명·183부서였고 중복 ID/빈 부서/빈 이메일은 없었다. 기록별 값은 검증 출력에 남기지 않았다. 해당 API에는 로그인 인증·조직도 계층·재직 상태 보증이 없으므로 이를 추정하지 않는다.

## API 계약 (로그인 연동 후 활성화)

| API | 용도 |
| --- | --- |
| GET `/api/me` | 인증된 자신의 원래 HR 필드 |
| GET `/api/employees?q=검색어` | 2~50자 검색, 최대 20명의 원래 HR 필드 반환 |
| GET `/api/workspace` | 자신의 수신함·발신함·포인트·발송 한도 |
| POST `/api/boosters` | 칭찬과 양쪽 포인트 원장을 한 트랜잭션으로 저장 |
| POST `/api/boosters/{id}/reply` | 자신의 수신 칭찬에 답장, 답장자 5P 한 번 지급 |
| GET `/api/leader/records?memberId=&direction=received` | 담당 부서 구성원의 받은/보낸 칭찬; 방향 `received`/`sent` |
| GET `/api/leaderboard` | 캠페인 전사 TOP 10, 공동 순위 |

보내기에는 UUID `Idempotency-Key` 헤더와 다음 JSON이 필요하다. 아래는 가상 값이다.

```json
{
  "recipientId": "example-user",
  "projectName": "가상 검증 업무",
  "partner": "동료",
  "recipientScope": "타팀",
  "missions": ["문서 작성", "평가 및 분석"],
  "boosts": ["정보 공유", "동료 지지"],
  "impacts": ["품질 향상", "팀워크 강화"],
  "message": "업무 자료를 정리해 주셔서 감사합니다."
}
```

같은 키/같은 본문 재시도는 같은 칭찬 ID를 반환하고 추가 지급하지 않는다. 같은 키/다른 본문은 409다. 선택 배열은 각 1~3개이며 순서를 유지한다. 답장 본문은 `{ "message": "감사합니다." }`다. 발신자/포인트/리더 권한을 요청 본문에서 받지 않는다.

## 실행 및 검사

```bash
npm ci --prefix backend --ignore-scripts
npm --prefix backend test
# 임시 DB에 가상 직원만 넣어 검사. 실제 운영 DB에서 실행하지 않는다.
IMAGE_TAG=preview-20260918-v2 bash deploy/verify-business.sh
```

실행 환경은 `DATA_API_KEY`, `DATA_API_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `CAMPAIGN_ID`를 사용한다. `DATABASE_URL`도 지원한다. 실제 값은 Kubernetes Secret/환경변수로 전달하며 이미지/values.yaml에는 비밀값을 넣지 않는다.

시작 시 마이그레이션과 전체 HR 동기화를 수행하고 1시간마다 다시 동기화한다. 정상 동기화가 24시간 이상 없으면 readiness와 인증 후 업무 접근을 실패 처리한다. 로그인 연동 전 업무 접근은 디렉터리 조회 전에 401로 차단한다.

권한이 있는 운영자만 컨테이너 안에서 `node scripts/admin.js sync-hr` 또는 `node scripts/admin.js leader-scopes USER_ID DEPT_CD...`를 실행한다. 부서 없이 후자를 호출하면 그 리더의 조회 범위를 제거한다. 실제 매핑은 사용자가 지정할 때만 등록한다.

추후 인증 어댑터는 신뢰할 수 있는 서버 세션/SSO에서 `userId`를 확정하고, 비활성 계정·Origin·CSRF를 검증해야 한다. 그 전에는 배포 서버에 `authorize`를 주입하지 않는다. API 키는 직원 인증 수단으로 사용하지 않는다.

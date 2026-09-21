# Supabase OpenAI 게이트웨이

프로젝트 `uadmxxpoxaukuwwvfdpr` / `IPS_OneTeamBooster`에 `openai-gateway`를 배포했다.

- URL: https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway
- 흐름: 사내 OTB 백엔드 → Supabase Edge Function → OpenAI Responses API.
- 사내 로그인·HR·칭찬·포인트 DB는 기존 사내 서버에서 처리한다. Supabase Auth 계정은 직원에게 요구하지 않는다.
- 이 함수는 칭찬 초안 생성 전용이며 범용 OpenAI 프록시가 아니다.

## 소속 구분 프롬프트 v2 · 배포 전

현재 로컬 코드는 `praise-ko-v2`다. 같은 팀/그룹은 편안한 존댓말, 타 팀/그룹은 정중한 협업 감사를 기본으로 하며 상사·선배에게는 정중함을 우선하고 후배·신입에게는 존중하는 격려를 사용한다. 친분·상황을 지어내지 않는다.

배포 시 Supabase 함수와 사내 백엔드를 같은 버전으로 맞춰야 한다. 백엔드는 다른 `promptVersion` 응답을 거부하므로 버전이 다른 배포 전환 구간에는 초안 생성이 실패할 수 있다. Jenkins는 사내 앱만 배포하므로 게이트웨이는 별도 업데이트가 필요하다. 버전 일치 후 가상 입력으로 여섯 조합을 실제 생성해 확인한다. 이번 작업에서는 전송 경로의 모의 검증만 수행했고 실제 AI 생성과 배포는 실행하지 않았다.

## 인증과 입력

호출자는 서버에만 보관한 `OTB_GATEWAY_TOKEN`을 Bearer 인증으로 보낸다. 공개 publishable/anon 키는 허용하지 않는다. Supabase의 사용자 JWT 검증은 `verify_jwt=false`이며 함수 내부에서 전용 토큰을 검증한다. 토큰이 없거나 32자 미만이면 모든 요청을 차단한다.

POST JSON은 `projectName`, `partner`, `recipientScope`, `missions`, `boosts`, `impacts`만 사용한다. `recipientScope`는 `같은팀` 또는 `타팀`이며, 실제 부서명을 전달하지 않는다. 기존 요청의 미입력은 중립적인 관계별 존댓말로 처리한다. 사번·이메일·수신자 이름·권한·호출자가 지정한 모델/프롬프트/URL은 전달하지 않는다. 업무명은 자유 입력이므로 사용자가 적은 기밀이나 개인정보까지 자동 제거되는 것은 아니다.

성공 응답은 `{message, source:"openai", model, promptVersion}`이다. 이름을 포함하지 않는 500자 이내 한국어 초안만 반환한다. `/health`도 인증을 요구하며 `configured`는 키의 존재 여부이고 실제 OpenAI 호출 성공을 보장하지 않는다.

## Secrets

- Supabase: `OPENAI_API_KEY`, `OTB_GATEWAY_TOKEN`, 선택적으로 `OPENAI_MODEL`.
- 기본 모델: `gpt-5.6-luna`, reasoning `none`, 출력 최대 700토큰, `store:false`.
- 호출 토큰의 로컬 보관 위치: Windows 자격 증명 관리자 `OneTeamBooster/openai-gateway/uadmxxpoxaukuwwvfdpr`.
- OTB 백엔드 연동 환경변수: `OPENAI_GATEWAY_URL`과 `OTB_GATEWAY_TOKEN`. 둘 중 하나만 있거나 대상 URL이 다르면 시작 시 차단한다. 이 경로에서는 OTB 서버의 OpenAI 키를 전송하지 않는다.
- OpenAI 키는 Supabase Secrets 화면에서 직접 입력한다. 코드·명령 인수·로그에 기록하지 않는다.

## 운영 명령

PowerShell 7에서 실행한다. 기존 `Supabase CLI:supabase` 자격증명을 사용하며 토큰 값은 출력하지 않는다.

```powershell
./deploy/Manage-OpenAiGateway.ps1 -Action Inspect
./deploy/Manage-OpenAiGateway.ps1 -Action Initialize
./deploy/Manage-OpenAiGateway.ps1 -Action Deploy
./deploy/Manage-OpenAiGateway.ps1 -Action Check
# 가상 업무로 실제 OpenAI 호출 1회. API 비용이 발생한다.
./deploy/Manage-OpenAiGateway.ps1 -Action Generate
```

Initialize는 기존 클라우드 Secret을 교체하지 않는다. 기존 Secret이 있지만 로컬 호출 토큰이 없으면 중단한다. Deploy는 이 함수만 생성/업데이트하며 다른 함수·DB·Auth 설정을 변경하지 않는다. 현재 배포는 Codex MCP의 동적 도구 반영을 기다리는 대신 기존 Supabase CLI 자격증명을 이용한 공식 Management API로 수행했다.

입력 4KiB, upstream 응답 64KiB, 생성 20초 제한이다. Edge 실행 인스턴스마다 동시 2개·분당 20회를 제한한다. 인스턴스 사이에는 카운터가 공유되지 않으므로 전체 비용 상한이 아니다. OTB 백엔드는 별도로 사용자당 분당 5회·프로세스 시간당 100회를 제한한다. 운영 확대 시 공유 저장소를 통한 전역 사용량 제한이 필요하다.

## 2026-09-21 검증

- Supabase 함수 최초 version 1 배포, OpenAI 키 등록 후 version 2 `ACTIVE` 확인.
- 미인증 `/health`: 401. 인증된 `/health`: 200.
- 사내 K3s의 실제 백엔드 Pod에서 같은 HTTPS 주소 응답 401 확인: 네트워크 연결 가능.
- `npm --prefix backend test`: 19개 통과.
- `node --test supabase/gateway.test.js`: 6개 통과. 인증, 입력 검증, HR/프롬프트/모델 주입 차단, 오류 비밀값 차단, 시간·호출 제한을 확인했다.
- 사용자가 Supabase Secrets에 직접 `OPENAI_API_KEY`를 등록했다. 인증된 health `configured:true` 확인.
- 가상 업무 1회 실제 생성: HTTP 200, `source:openai`, `model:gpt-5.6-luna`, `promptVersion:praise-ko-v1`, 한국어 107자. 직원 데이터·칭찬 원장 쓰기는 사용하지 않았다.
- 2026-09-21 14:15 KST 사내 앱을 게이트웨이 경로로 전환했다. 14:17 KST 배포 안내까지 갱신한 최종 Helm 리비전은 11이다. 프런트·백엔드 모두 Harbor 이미지 `gateway-20260921-141403`의 검증된 Linux amd64 digest를 사용한다.
- `otb-runtime`에는 기존 HR·DB 값을 유지하고 `OTB_GATEWAY_TOKEN`만 추가했다. 토큰은 Windows 자격 증명 관리자에서 SSH 표준입력으로만 전달했으며 파일·명령 인수·로그에 기록하지 않았다. `OPENAI_GATEWAY_URL`은 Helm 설정으로 주입한다. 사내 서버에는 OpenAI API 키가 없다.
- 배포 후 실제 `/api/drafts` 호출: HTTP 200, 한국어 102자, `gpt-5.6-luna`. 포인트·받은/보낸 기록 불변, 미인증 401·잘못된 Origin 403·리더 조회 403 확인.
- 전체 로컬 단위검증 57개, 원격 PostgreSQL 통합검증 2개, 이미지 빌드·Helm lint·클러스터 dry-run·HTTP 검증이 통과했다. 브라우저에서 실제 생성·수정 가능을 확인했고 초안을 전송하지 않은 채 닫았다.

## 사내 앱 배포 재현

최초 배포는 검증한 로컬 작업본을 수동 반영했다. 이후 업데이트는 게이트웨이 연동 소스와 설정을 포함한 main을 Jenkins가 자동 배포한다. Jenkins는 게이트웨이 단위 테스트와 배포 후 AI 활성화 상태를 검증한다. Supabase 함수 자체의 변경은 아래 관리 도구로 별도 배포한다.

원격 작업본: `/home/admin/.local/share/otb-ops/gateway-20260921-141403`.

- `deploy/configure-gateway-secret.py`: SSH stdin의 호출 토큰 한 개만 Secret에 추가하고 기존 HR·DB 항목을 보존한다.
- `deploy/publish-gateway-preview.py <image-tag> <expected-helm-revision>`: 검증 완료된 이미지를 Harbor에 push하고 원격 digest를 확인한다. 현재 릴리스가 예상 리비전과 일치할 때만 설정을 보존해 업그레이드한다. Helm 실패는 atomic rollback, 배포 후 AI 검증 실패는 직전 리비전으로 롤백한다.
- `deploy/verify-ai-gateway.mjs`: 배포된 백엔드 Pod에서 실행한다. 실제 앱 API로 가상 초안 한 번을 만들며 칭찬 발송이나 포인트 적립은 수행하지 않는다.

프롬프트 또는 선택 항목을 변경하면 `backend/praise-prompt.js`, `backend/domain.js`와 게이트웨이의 대응 파일을 함께 갱신한다. 테스트가 두 구현의 일치 여부를 확인한다.

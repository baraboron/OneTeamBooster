# OneTeam Booster

2026-09-21: 송재현·김영훈 선택과 HR 검색 기반 칭찬·답장·포인트를 서버 테스트 원장에 연결했습니다. GitHub main 변경은 Jenkins가 1분 간격으로 감지하고, 검증 후 사내 K3s에 자동 배포합니다. 실제 로그인은 아닙니다. 운영 방법은 [deploy/CI.md](deploy/CI.md), 검증 결과는 [deploy/VALIDATION.md](deploy/VALIDATION.md)를 참고하세요.

원익IPS OneTeam 조직문화를 위한 AI 기반 협업격려 캠페인 웹 프로토타입입니다.

## 핵심 경험

- 협업 직후 4개 선택 항목으로 부스터 메시지 생성
- 수신, 감사 답장, 포인트 반영
- 개인 협업 임팩트와 리더용 조직 간 연결 인사이트

업무현황·진척 관리를 위한 도구가 아니라, 구체적인 협업 기여를 인정하고 조직의 연결을 강화하는 캠페인 도구입니다.

## 실행

사내망 테스트 주소: **http://192.168.20.72:30081**. 지정된 두 사용자를 선택하면 HR 검색과 서버 PostgreSQL의 분리된 테스트 원장을 사용한다. 정식 로그인은 보류했다. 상세 배포 상태는 `deploy/README.md`, API 계약은 `backend/README.md` 참고.

프런트엔드 파일만 로컬에서 확인하려면 아래 HTTP 서버로 실행한다. 테스트 사용자·HR·기록 API를 사용하려면 위의 K3s 사이트 또는 백엔드와 동일 출처 프록시 구성이 필요하다.

```powershell
node -e "require('http').createServer((q,s)=>require('fs').createReadStream(q.url==='/'?'index.html':'.'+q.url).pipe(s)).listen(4173)"
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## 문서

- `deploy/README.md`: 현재 K3s 배포와 상태 확인
- `deploy/CI.md`: Jenkins main 자동 배포, 권한, 롤백 및 TLS 갱신 기록
- `AGENTS.md`: 제품 정의, MVP 범위, UX 및 구현 원칙
- `DESIGN_GUIDELINES.md`: 조사 근거, 디자인 토큰, 화면별 규칙, 접근성 및 지속 적용 기준
- `FEATURE_AUDIT.md`: 현재 시제품의 기능 상태와 운영 전 후속 과제
- `MOTIVATION_COPY.md`: 개인 칭찬 상태별 응원 문구 98개 조각 / 672가지 조합
- `LEADERBOARD_API.md`: 전사 TOP 10 서버 응답·자동 갱신·시연 구분 계약
- `PRODUCT_PLAN.md`: 문제 정의, 정보 구조, 릴리스 순서, 성공 지표
- `WONIKIPS_CI(JPG)/`: 제공받은 원익IPS CI 원본
- `assets/wonikips-ci-full.jpg`: 화면에 사용하는 무절단 원익IPS 워드마크 자산

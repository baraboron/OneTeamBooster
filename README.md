# OneTeam Booster

2026-09-21: 송재현·김영훈을 선택하는 테스트 사용자 모드와 HR 검색 기반 칭찬·답장·포인트 흐름을 구현했습니다. 테스트 기록은 서버의 별도 스키마에 저장되며 실제 로그인은 아닙니다. 사용자 승인 후 기존 사내 사이트(http://192.168.20.72:30081)에 리비전 3으로 배포했고 실제 HTTP 검색·사용자별 조회를 확인했습니다. 상세 범위는 [FEATURE_AUDIT.md](FEATURE_AUDIT.md), 검증은 [deploy/VALIDATION.md](deploy/VALIDATION.md)를 참고하세요.

원익IPS OneTeam 조직문화를 위한 AI 기반 협업격려 캠페인 웹 프로토타입입니다.

## 핵심 경험

- 협업 직후 4개 선택 항목으로 부스터 메시지 생성
- 수신, 감사 답장, 포인트 반영
- 개인 협업 임팩트와 리더용 조직 간 연결 인사이트

업무현황·진척 관리를 위한 도구가 아니라, 구체적인 협업 기여를 인정하고 조직의 연결을 강화하는 캠페인 도구입니다.

## 실행

사내망 시연 주소: **http://192.168.20.72:30081**. 화면의 칭찬은 브라우저에만 저장된다. 서버에는 인사 API 동기화 및 PostgreSQL 업무 로직을 준비했으며, 로그인은 추후 구현 요청에 따라 보류했다. 상세 배포 상태는 `deploy/README.md`, API 계약은 `backend/README.md` 참고.

정적 사이트입니다. `index.html`을 브라우저에서 열거나, 로컬 HTTP 서버로 실행합니다.

```powershell
node -e "require('http').createServer((q,s)=>require('fs').createReadStream(q.url==='/'?'index.html':'.'+q.url).pipe(s)).listen(4173)"
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## 문서

- `deploy/README.md`: 원격 K3s 조사 결과, 프런트엔드/API 기본 서버의 Helm 배포 준비·검증·후속 과제
- `AGENTS.md`: 제품 정의, MVP 범위, UX 및 구현 원칙
- `DESIGN_GUIDELINES.md`: 조사 근거, 디자인 토큰, 화면별 규칙, 접근성 및 지속 적용 기준
- `FEATURE_AUDIT.md`: 현재 시제품의 기능 상태와 운영 전 후속 과제
- `MOTIVATION_COPY.md`: 개인 칭찬 상태별 응원 문구 98개 조각 / 672가지 조합
- `LEADERBOARD_API.md`: 전사 TOP 10 서버 응답·자동 갱신·시연 구분 계약
- `PRODUCT_PLAN.md`: 문제 정의, 정보 구조, 릴리스 순서, 성공 지표
- `WONIKIPS_CI(JPG)/`: 제공받은 원익IPS CI 원본
- `assets/wonikips-ci-full.jpg`: 화면에 사용하는 무절단 원익IPS 워드마크 자산

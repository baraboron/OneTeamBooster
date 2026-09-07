# OneTeam Booster

원익IPS OneTeam 조직문화를 위한 AI 기반 협업격려 캠페인 웹 프로토타입입니다.

## 핵심 경험

- 협업 직후 4개 선택 항목으로 부스터 메시지 생성
- 수신, 감사 답장, 포인트 반영
- 개인 협업 임팩트와 리더용 조직 간 연결 인사이트

업무현황·진척 관리를 위한 도구가 아니라, 구체적인 협업 기여를 인정하고 조직의 연결을 강화하는 캠페인 도구입니다.

## 실행

정적 사이트입니다. `index.html`을 브라우저에서 열거나, 로컬 HTTP 서버로 실행합니다.

```powershell
node -e "require('http').createServer((q,s)=>require('fs').createReadStream(q.url==='/'?'index.html':'.'+q.url).pipe(s)).listen(4173)"
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## 문서

- `AGENTS.md`: 제품 정의, MVP 범위, UX 및 구현 원칙
- `PRODUCT_PLAN.md`: 문제 정의, 정보 구조, 릴리스 순서, 성공 지표
- `WONIKIPS_CI(JPG)/`: 제공받은 원익IPS CI 원본
- `assets/wonikips-wordmark.jpg`: 화면에 사용하는 워드마크 자산

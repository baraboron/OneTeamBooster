## 2026-09-21 11:22 KST fetch 호출 오류 수정 · 리비전 4

- 사용자 승인 후 프런트엔드만 `fetch-fix-20260921-v1`로 교체했다. Helm atomic upgrade 성공, 프런트엔드·백엔드 Deployment 1/1 Ready. 백엔드는 `test-users-20260921-v1` 유지.
- `api-client.js`, `leaderboard-client.js`의 기본 fetch 함수를 전역 객체를 통해 호출하도록 수정했다. Window 호출 대상 검사 회귀 테스트 2개는 수정 전 동일 오류로 실패하고 수정 후 통과했다.
- 로컬 관련 테스트 23개 통과. 원격 회귀 테스트 2개, `IMAGE_TAG=fetch-fix-20260921-v1 VALIDATE_CLUSTER=1 bash deploy/verify.sh` 통과(백엔드 12개, 이미지 빌드, Helm lint/template/server dry-run, HTTP 및 nginx 검사).
- 실제 브라우저에서 배포 전 Illegal invocation을 재현했다. 배포 후 새로고침으로 오류 해소 및 지정 테스트 사용자 목록 표시를 확인했고, 사용자 선택 후 서버 연결됨과 테스트 집계 표시를 확인했다.
- 검증용 칭찬·답장 기록을 생성하지 않았다. 원격 소스: `/home/admin/tmp/otb-fetch-fix-20260921`.

## 2026-09-21 11:05 KST 배포 완료 · 리비전 3

- 사용자가 공개 범위를 설명받은 뒤 명시적으로 배포를 요청했다. Helm atomic upgrade가 성공했으며 이전 리비전 2는 superseded, 리비전 3은 deployed다.
- 프런트엔드·백엔드 Deployment 모두 1/1 Ready. 이미지 태그 test-users-20260921-v1, 테스트 저장 스키마 otb_preview.
- 실제 사이트 http://192.168.20.72:30081 에서 HTML/추가 JS/CSS 200, testUserMode=true, productionReady=false 확인.
- 지정한 두 테스트 사용자 목록, 각각의 workspace 사용자 일치, 상대 사용자 검색과 본인 제외, 183개 부서 조회, test 범위 순위 확인.
- 미선택 사용자 401, 허용 목록 밖 사용자 403, 리더 조회 403, 다른 Origin의 POST 403 확인. 개인정보나 계정 ID를 검증 출력에 남기지 않았다.
- 배포 확인용 칭찬·답장·포인트 기록은 생성하지 않았다. 쓰기/중복 지급/운영 원장 분리는 앞서 가상 PostgreSQL 통합 검사로 확인했다. 실제 브라우저 검증은 미실행이다.

## 2026-09-21 테스트 사용자 연동 · 배포 승인 대기

- HR 이름 조회는 송재현 1건, 김영훈 1건. 이름별 건수만 출력했으며 테스트 계정 ID는 소스/이미지에 넣지 않았다.
- 로컬 프런트엔드/도메인 30개 통과. 실제 클라이언트 모듈을 포함한 DOM 실행 하네스에서 사용자 선택, 임직원 검색 결과 선택, 서버 전송, 사용자 전환, 포인트 반영, LocalStorage 미기록을 확인했다. 실제 브라우저 검증과는 구분한다.
- 백엔드 12개, 임시 PostgreSQL 통합 2개 통과. 테스트 전용 스키마, 허용된 두 사용자, 미선택/다른 사용자 거부, Origin 거부, 자기 계정 수신함, 중복 전송·답장 및 10/20/5 포인트, public 원장 불변을 확인했다.
- IMAGE_TAG=test-users-20260921-v1 VALIDATE_CLUSTER=1 bash deploy/verify.sh 및 같은 태그의 deploy/verify-business.sh 통과. 최종 로그: /home/admin/tmp/otb-test-users-20260921-validation.log.
- 신규 이미지 두 개를 K3s에 import 완료. Helm upgrade는 자동 승인 검토가 기존 공유 사이트의 인증 없는 테스트 모드 공개에 대한 명시적 승인을 요구해 거절했다. 업그레이드는 실행되지 않았고 기존 릴리스 리비전 2를 유지한다.
- 사용자에게 공개 범위를 설명한 배포 승인 질문을 전달했다. 승인 전 추가 배포/서비스 전환은 하지 않는다. 신규 라이브 HTTP 및 브라우저 검증은 아직 수행하지 않았다.

## 2026-09-21 임직원 검색 변경 · 배포 전 검증

- HR API 실호출: 1,501명, 183부서, 중복 ID/빈 부서/빈 이메일 0. INSERT_DT를 포함한 원래 8개 필드로 전체 페이지 검증. 키는 Windows 자격 증명 관리자에서 프로세스 환경변수로만 전달했고 직원별 값은 출력하지 않았다.
- 로컬 프런트엔드/도메인 검사 26개, 백엔드 검사 12개 통과. 검색 응답 순서 역전, 동명이인 ID 선택, 오류/재시도, 더 보기, 닫힌 창의 요청 무효화, 텍스트 렌더링, 실제 직원 초안 저장 차단, 2·3순위 저장/재사용/집계를 포함한다.
- 원격 가상 PostgreSQL 통합 검사 1개 통과. 이메일 검색, 부서 필터, 본인 제외, 와일드카드 문자, 빈 페이지, 부서 집계와 기존 트랜잭션/동시성/포인트/리더 범위를 확인했다. 운영 DB 자료로 쓰기 테스트하지 않았다.
- IMAGE_TAG=directory-20260921 VALIDATE_CLUSTER=1 bash deploy/verify.sh 통과: 두 이미지 빌드, 컨테이너 백엔드 12개, Helm lint/template/server dry-run, nginx 구문 검사, 모든 브라우저 자산 및 API 프록시 HTTP 검사.
- 검증 폴더: /home/admin/tmp/otb-directory-20260921. 최종 배포 검증 로그: /home/admin/tmp/otb-directory-20260921-validation.log. 임시 테스트 컨테이너/네트워크는 검증 스크립트가 종료 시 정리했다.
- 실제 브라우저 화면/키보드 검증은 미실행. 실행 중인 Helm 릴리스는 변경하지 않았다. 로그인 없는 검색 공개 여부가 결정되지 않아 previewEmployeeSearch는 기본 false다. 실제 칭찬 전송·답장·포인트·리더 조회는 인증 연결 후 활성화한다.

# 최종 검증 · 2026-09-18

## 실제 배포

- 접속 주소 http://192.168.20.72:30081 에서 HTTP 200 및 OneTeam Booster 화면 확인.
- namespace oneteambooster-preview, release otb, chart 0.2.0.
- 프런트엔드·백엔드·PostgreSQL Pod 모두 Ready, DB PVC local-path 2Gi Bound.
- 백엔드는 DB 최초 준비 중 한 번 재시작한 뒤 정상 기동했다.
- 배포된 백엔드에서 HR API 전체 페이지 조회: 1,504명, 183부서, 중복 ID·빈 부서·빈 이메일 0건. 직원 상세값은 출력하지 않았다.
- /api/system: preview, productionReady=false. 인증 없이 인사 검색과 리더 API 호출 시 401 AUTH_NOT_CONFIGURED 확인.
- 배포 시 실제 칭찬·답장·포인트 원장은 만들지 않았다. 공개 화면은 LocalStorage 시연이다.

## 자동 검사

- 로컬 Node 검사 32개 통과: 기존 UI/도메인 20개와 백엔드 10개, API 클라이언트 2개.
- 원격 컨테이너 Node 24.21.0에서 백엔드 10개 통과.
- 가상 직원만 사용하는 임시 PostgreSQL DB 통합 검사 1개 통과. 검증 DB 이름이 otb_test가 아니면 실행을 거부한다.
- DB 통합 검사: 동일 요청 동시 재시도, 중복 답장, 발신 10P·수신 20P·답장자 5P, 하루 3회 제한의 경쟁 요청, 동일 수신자 주 1회, 발신자 추가 지급 없음, 비수신자 답장 차단, 담당 부서 외 접근 차단, 2·3순위 배열 보존, 새 DB 연결에서 기록 유지, HR 실패 시 기존 데이터 보존, 새 HR 목록에서 제외된 사용자 비활성화.
- Helm 기본·K3s 예시 lint, Ingress/TLS 렌더링·빈 hostname 거부, 서버 dry-run, PostgreSQL/NodePort 포함 프리뷰 값의 서버 dry-run 통과.
- 비루트 UID, readOnlyRootFilesystem, 권한 제한 상태에서 이미지 빌드·Nginx 설정 검사·화면 자산·API 프록시·소스파일 비노출 확인.
- 실제 배포는 side-loaded 이미지와 pullPolicy Never를 사용하며 기존 Harbor/DNS/TLS/다른 앱을 변경하지 않았다.

## 브라우저 검사

Codex 브라우저에서 홈 화면, 시연 안내, 작성창, 프로젝트명 입력, 템플릿 초안 생성, 시연 칭찬 저장(95P→105P), 새로고침 후 105P 유지와 기록 노출을 확인했다. 실제 직원에게 메시지를 전송한 것이 아니다. 데스크톱 스크린샷으로 화면 배치도 확인했다. 모바일·다른 브라우저 전체 QA는 수행하지 않았다.

## 기록 위치

- 원격 /home/admin/tmp/otb-preview-20260918-v2/verify.log
- 원격 source.tar.gz, preview-images.tar (193MiB 수준; 비밀값 없음)
- 로컬 artifacts/verification-preview-20260918.log
- 로컬 artifacts/oneteambooster-0.2.0.tgz
- 실제 값: deploy/values-preview.yaml (비밀값 없음)
- API 계약: backend/README.md

## 후속 과제

사용자가 로그인 구현을 추후로 지정했다. 실제 사용자별 UI 서버 연동·SSO·CSRF·운영 그룹 매핑·실제 AI 생성은 아직 활성화되지 않았다. API 로직 검증과 인증된 실사용을 구분한다. 단일 노드 local-path DB이므로 정식 운영 전 백업/복구·고가용성 설계가 필요하다. Harbor 인증서 만료일은 2026-05-08 23:59:59 UTC이며 임의 갱신/검증 우회는 하지 않았다.
## 2026-09-21 11:35 KST Jenkins 자동 배포 · 최초 성공 리비전 5

- GitHub main 연결 및 push 완료. Jenkins `OneTeamBooster-main` 빌드 #2가 **Started by an SCM change / SUCCESS**로 완료됐다. 검증 커밋 `9dbb3d004d51`, 이미지 태그 `9dbb3d004d51-2`. 수동 Build 호출은 최초 #1에만 사용했다.
- Jenkins 임시 Pod에서 프런트엔드 32개·백엔드 12개·임시 PostgreSQL 통합 2개, 총 46개 통과. Helm lint 및 namespace 제한 계정의 클러스터 dry-run 통과.
- Harbor에 프런트/백엔드 이미지를 TLS 검증을 유지하며 push하고 digest로 고정 배포했다. Helm atomic upgrade 리비전 5 성공, 두 Deployment 1/1 Ready. 실제 HTTP의 페이지, 두 사용자 workspace, HR 검색과 본인 제외, 미선택 401, testUserMode=true 및 productionReady=false를 확인했다. 실제 직원 칭찬/답장 쓰기는 하지 않았다.
- 원격 `/home/admin/tmp/otb-ci-verify-20260921`에서도 `IMAGE_TAG=ci-verify-20260921 VALIDATE_CLUSTER=1 bash deploy/verify.sh`와 `deploy/verify-business.sh` 통과. 브라우저 검증은 앞선 리비전 4 기록과 구분하며 이번 CI 연결에서는 새로 수행하지 않았다.
- `jenkins/otb-ci` 계정은 `oneteambooster-preview` Deployment 수정 가능, `wonix` Deployment 수정 불가를 확인했다. 호스트 Docker 소켓/privileged 권한 없이 빌드했다.
- 최초 #1은 checkout 반환 커밋 변수를 연결하지 않아 실패했으며 배포 단계에 도달하지 않았다. 수정 후 SCM 자동 빌드 #2가 전체 단계를 통과했다.
- 저장된 비밀값과 private-key 파일을 검사하고 75개 변경 파일에 포함되지 않음을 확인했다. NginX와 tmp는 Git에서 제외했다.
- K3s 외부 TLS Secret 5개 갱신과 6개 서비스 도메인의 새 인증서·신뢰 체인 검증 완료. 제공 인증서 만료 2026-11-20 23:59:59 UTC. 상세 대상과 백업 위치는 CI.md 참고.

이하 기록은 해당 시점의 이력이며 현재 상태는 위 Jenkins 결과와 deploy/README.md를 따른다.

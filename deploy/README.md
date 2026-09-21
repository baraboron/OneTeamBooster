# 현재 시연 배포

**접속 주소: http://192.168.20.72:30081** (사내망)

2026-09-21 14:17 KST: **사내 앱 → Supabase 게이트웨이 → OpenAI 호출을 배포했다(Helm 리비전 11).** 실제 `/api/drafts`에서 한국어 초안 생성과 포인트·기록 불변을 확인했다. 브라우저에서도 생성·수정 화면을 확인했다. 상세 구성·검증·수동 배포 이력은 [OPENAI_GATEWAY.md](OPENAI_GATEWAY.md) 참고. 이후 사내 앱 업데이트는 main의 게이트웨이 설정을 사용해 Jenkins가 자동 배포한다.

아래 Jenkins 및 리비전 3~5 내용은 게이트웨이 연결 이전 이력이다.

2026-09-21 11:35 KST: **Jenkins main 자동 배포를 연결했고 SCM 변경으로 시작된 빌드 #2가 성공했다.** 단위·통합 테스트 46개, Helm 검증, Harbor push, Helm 리비전 5 배포 및 실제 HTTP 확인이 통과했다. 이후 main 변경은 1분 간격으로 감지한다. 최신 커밋/배포 결과와 운영 절차는 [Jenkins](https://wonix-cicd.ips.co.kr/job/OneTeamBooster-main/) 및 [CI.md](CI.md) 참고.

아래 리비전 3·4는 자동 배포 연결 전 이력이다.

2026-09-21 11:22 KST 사용자 승인으로 Helm 리비전 4에 프런트엔드 `fetch-fix-20260921-v1`을 반영했다. 브라우저의 `fetch` 호출 대상이 잘못되어 발생하던 `Illegal invocation`을 수정했다. 실제 브라우저에서 오류 해소, 테스트 사용자 목록과 사용자 선택 후 서버 연결 및 테스트 집계를 확인했다. 백엔드 이미지는 기존 버전을 유지한다.

2026-09-21 11:05 KST 사용자 승인 후 Helm 리비전 3으로 배포했다. 송재현·김영훈 테스트 사용자 선택, 실제 HR 검색, 서버의 칭찬·답장·포인트·테스트 TOP 10을 사용할 수 있다. 정식 로그인은 아니며 접속자가 두 사용자 중 하나를 선택하는 테스트 모드다.

프런트엔드·백엔드 모두 Ready이고 실제 HTTP에서 두 사용자별 조회, 상대 사용자 검색, 본인 제외, 183개 부서, 테스트 순위와 접근 제한을 확인했다. 테스트 기록은 PostgreSQL otb_preview 스키마에 저장하고 public 운영 원장과 분리한다. 리더 조회는 403이다. 메시지는 기존 템플릿 초안이며 실제 AI 모델 생성은 연결하지 않았다.

리비전 3의 배포 전 검증 44개와 Docker·Helm·HTTP 검증이 통과했다. 리비전 4는 관련 로컬 테스트 23개, 원격 회귀 테스트 2개 및 Docker·Helm·HTTP 검증을 통과했다. 실배포 확인 중 테스트 칭찬을 생성하지 않았다. 상세 기록은 VALIDATION.md를 참고한다.

## 배포 정보

| 항목 | 실제 상태 |
| --- | --- |
| 호스트 / 노드 | admin@192.168.20.72 / web-j3-w01 |
| K3s | v1.34.5+k3s1, 클러스터 3노드 |
| Namespace / Helm release | oneteambooster-preview / otb |
| Chart / app version | 0.2.0 / 0.2.0 |
| 값 파일 | deploy/values-preview.yaml + deploy/values-ci.yaml |
| 소스 / 빌드 | GitHub main / Jenkins 임시 Kubernetes agent |
| 프런트엔드 | NodePort 30081 / 내부 8080 |
| 백엔드 | ClusterIP 3000, Node 24 + pg |
| DB | PostgreSQL 17, local-path PVC 2Gi |
| 앱 이미지 | wonix-ops.ips.co.kr/library/oneteambooster-{frontend,backend}:커밋12자리-빌드번호 |
| 이미지 배포 방식 | Harbor push 후 digest 고정, IfNotPresent; DB는 기존 postgres:17-alpine 유지 |
| HR 동기화 | 시작 시 + 매시간, 2026-09-21 전체 조회 1,501명 / 183부서 |
| 사용자 선택 / UI 연동 | 지정된 두 테스트 사용자 선택, HR 검색 및 서버 테스트 기록 연동 |

Harbor와 외부 Ingress TLS는 사용자 제공 인증서로 갱신했고 실제 신뢰 체인/호스트명 검증을 통과했다. 만료는 2026-11-20 23:59:59 UTC다. 현재 프리뷰는 단일 노드에 고정되어 있으며 HA 구성이 아니다. 운영 전 DB 백업·복구, SSO, 명시적 리더 부서 매핑이 필요하다.

## 비밀정보

- HR API 키: 현재 Windows 자격 증명 관리자 `OneTeamBooster/hr-api/ax.ips.co.kr`; 서버 환경변수 DATA_API_KEY.
- DB 비밀번호: 자격 증명 관리자 `OneTeamBooster/postgres/oneteambooster-preview`; 서버 환경변수 PGPASSWORD.
- K3s에서는 전용 namespace의 `otb-runtime` Secret을 사용한다. frontend에는 전달하지 않는다.
- 키/비밀번호/실제 직원 목록을 로그·문서·소스·컨테이너 이미지에 넣지 않는다. 배포용 일시 파일은 제거했다.
- `deploy/Initialize-PreviewSecret.ps1`은 최초 생성 전용이다. 기존 Secret을 감지하면 중단한다. 비밀번호 변경은 별도 회전 절차로 진행한다.

## 상태 확인 (원격 Linux)

```bash
kubectl -n oneteambooster-preview get pods,services,pvc
helm status otb -n oneteambooster-preview
kubectl -n oneteambooster-preview exec deployment/otb-oneteambooster-backend -- node scripts/check-hr.js
```

마지막 명령은 총건수·품질 통계만 출력한다. `/api/system`은 preview / productionReady=false를 반환한다. `/api/system`의 testUserMode=true를 확인한다. 두 테스트 사용자 중 하나를 선택한 요청만 검색·조회·전송·답장을 허용한다. 미선택은 401, 다른 사용자 및 리더 조회는 403이다. health/readiness는 정식 로그인 기능 완성을 의미하지 않는다.

## 재검증·업데이트

```bash
# 원격 소스 루트에서. test DB와 직원 데이터는 모두 가상이다.
IMAGE_TAG=test-users-20260921-v1 VALIDATE_CLUSTER=1 bash deploy/verify.sh
IMAGE_TAG=test-users-20260921-v1 bash deploy/verify-business.sh
```

일반 업데이트는 검토된 변경을 main에 push하면 Jenkins가 수행한다. 이미지를 직접 적재하는 기존 수동 배포 명령을 CI 값 없이 실행하면 과거 이미지로 돌아갈 수 있다. Jenkins의 성공 여부와 다음 명령으로 상태를 확인한다.

```bash
helm status otb -n oneteambooster-preview
helm history otb -n oneteambooster-preview
# 필요한 경우 확인한 이전 리비전으로만 복구한다.
# helm rollback otb <revision> -n oneteambooster-preview --wait
```

Windows에서는 `Invoke-RemotePc.ps1 -RemoteCommand`, `-UploadFile/-DestinationPath`, `-DownloadFile/-LocalPath`를 사용한다. `-Sudo`는 저장된 SSH 자격 증명을 표준입력으로만 전달한다. 자격 증명과 네트워크 접근에는 같은 Windows 사용자 컨텍스트의 샌드박스 외부 실행이 필요할 수 있다.

차트 패키지는 `helm package deploy/helm/oneteambooster --destination artifacts`로 만든다. 실제 CI는 preview/ci 값 파일과 빌드별 digest를 함께 적용한다. Secret 값은 패키지에 포함되지 않는다. 데이터 PVC는 Helm 제거만으로 자동 삭제하지 않으며 DB 자료를 삭제하는 명령을 사용하지 않는다.

## 코드와 남은 연결 작업

`backend/README.md`에 테스트 API 계약과 후속 인증 어댑터 기준을 기록했다. UI의 직원 검색·저장·조회·포인트는 서버 테스트 모드에 연결했다. 정식 운영 전 서버 세션/SSO·CSRF 검증·리더 그룹 매핑을 연결하고 테스트 원장을 운영 기록으로 오인하지 않도록 분리해야 한다. 현재 공개 화면을 로그인 완료나 실사용 완료로 표현하지 않는다. 테스트 모드의 AI 생성은 Supabase 게이트웨이에 연결되어 있으며, 로컬 시연 모드는 템플릿을 사용한다.

검증 증거는 `deploy/VALIDATION.md` 참고.

## 참고 문서

- [K3s private registry 설정](https://docs.k3s.io/installation/private-registry)
- [Helm template 검증 범위](https://helm.sh/docs/helm/helm_template/)
- [node-postgres 트랜잭션](https://node-postgres.com/features/transactions)
- [node-postgres 파라미터 쿼리](https://node-postgres.com/features/queries)

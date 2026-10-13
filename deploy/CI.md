# main 자동 배포

## SSO Bitbucket CI/CD · 2026-10-13

- 저장소: `DTSWGDS/wonix_sso_backend`, 배포 브랜치: `main`.
- Jenkins: `WonIX_SSO_Backend-main`, Pipeline from SCM, 루트 `Jenkinsfile`, 자격 증명 ID `kimyh7-bitbucket`.
- 사용자가 업로드한 소스는 `master`에 있었으며, PR #1로 `main`에 통합했다(`9028515c60af`). 루트 소스에 맞게 이미지 빌드 경로를 수정했다(`e0924ae43a2`).
- `main` push는 저장소 Webhook `WonIX SSO main Jenkins CI`가 `https://wonix-cicd.ips.co.kr/bitbucket-hook/`으로 전달한다. 연결 테스트 HTTP 200과 자동 빌드 #9 SUCCESS (`7cf63c0bad6`)를 확인했다. `H/1 * * * *` SCM 폴링도 등록되어 있지만 타이머 실행은 확인되지 않았다. 소스 확인 → Harbor 이미지 빌드/push → `platform-auth/oneteam-sso` digest 배포 → 준비 상태와 `/healthz` 확인 순서다.
- 환경변수는 기존 `oneteam-sso-runtime` Secret에서 주입한다. `.env`는 Git과 이미지에서 제외한다.
- SSO의 `REDIS_HOST`는 `redis-common.platform-auth.svc.cluster.local`, `REDIS_PORT`는 `6379`다. 기존 Secret의 외부 Redis 주소/포트를 클러스터 Redis 주소로 수정했으며 계정/비밀번호는 변경하지 않았다.
- `otb-ci`의 기존 Deployment `get` 권한으로 generation/updated/ready/available replica를 확인한다. `rollout status`의 list/watch 권한 오류를 해결하기 위해 권한을 넓히지 않고 조회 방식을 수정했다(`30214b8b41a`).
- Jenkins 브라우저 세션 대신 `Invoke-Jenkins.ps1`과 Windows 자격 증명 관리자 `OneTeamBooster/jenkins/wonix-cicd.ips.co.kr`를 사용한다. 인증정보는 하위 Node 프로세스 환경에만 전달하고 출력하지 않는다.
- 첫 정상 배포: Jenkins #8 SUCCESS, `30214b8b41a`, 2026-10-13 14:55 KST. Deployment generation/observedGeneration 9, desired/updated/ready/available replica 모두 1, HTTP health 확인 통과.

이 절은 SSO 전용 작업이다. 아래 GitHub `OneTeamBooster-main` 앱 배포 작업과 별개다.

### SSO env 변경 반영

원격 `.env` 원본은 `/home/admin/tmp/sso/.env`에 있고, 실행 Pod는 `platform-auth/oneteam-sso-runtime` Secret을 읽는다. 원격 서버에서 다음 명령을 실행한다.

```bash
python3 /home/admin/tmp/sso/sync-sso-env.py --env-file /home/admin/tmp/sso/.env
```

이 도구의 로컬 원본은 `deploy/sync-sso-env.py`다. dotenv 문법으로 파싱·검증하고 SSO 설정을 Secret에 반영한 뒤 Deployment를 재시작하고 최대 120초간 완료를 확인한다. 공용 Redis 주소/포트 및 `redis-common-auth` 계정/비밀번호는 자동 보존한다. 값은 출력하지 않는다. `kubectl create secret --from-env-file`로 전체 env를 다시 덮으면 외부 Redis 계정이 들어가 readiness 503을 일으킬 수 있으므로 이 도구를 사용한다.

2026-09-21 14:17 KST에 사용자 요청으로 로컬 작업본의 Supabase AI 게이트웨이 연동을 수동 배포했다(Helm 11, `gateway-20260921-141403`). 게이트웨이 설정과 소스를 main 자동 배포 대상에 포함한다. Jenkins는 게이트웨이 단위 테스트와 배포 후 AI 활성화 상태도 검증한다. 검증·이미지·운영 절차는 [OPENAI_GATEWAY.md](OPENAI_GATEWAY.md) 참고.

- Git: https://github.com/baraboron/OneTeamBooster (main)
- Jenkins: https://wonix-cicd.ips.co.kr/job/OneTeamBooster-main/
- 서비스: https://oneteam.ips.co.kr (Ingress NGINX, VIP `192.168.20.90`)
- 대상: `oneteambooster-preview` / Helm release `otb`

`Jenkinsfile`은 main을 1분 간격으로 폴링한다. 최초 실행 이후 트리거가 등록된다. GitHub에서 사내 Jenkins로 연결되는 webhook이나 외부 포트 개방은 필요하지 않다. 첫 실행과 자동 변경 감지 확인 결과는 `VALIDATION.md`에 기록한다.

순서는 main checkout → 프런트/백엔드 단위검증 → 임시 PostgreSQL 통합검증 → Helm lint 및 클러스터 dry-run → Harbor 이미지 push → Helm atomic upgrade → 실제 HTTP 확인이다. 빌드마다 임시 Kubernetes Pod를 사용하며 호스트 Docker 소켓이나 privileged 컨테이너를 사용하지 않는다. 임시 DB는 Pod의 loopback에서만 접속하고 Pod 종료 시 삭제한다.

이미지는 `wonix-ops.ips.co.kr/library/oneteambooster-{frontend,backend}:<commit12>-<build>`로 올리고, 실제 배포는 registry digest로 고정한다. 기존 인증서 검증을 유지한다. `library`는 현재 공개 프로젝트이며 앱 이미지에는 직원 데이터·인증서·비밀번호를 포함하지 않는다. 빌드 자격 증명은 기존 `jenkins/harbor-credentials` Secret을 읽기 전용으로 사용한다.

`deploy/values-preview.yaml` 위에 `deploy/values-ci.yaml`을 적용한다. 기존 NodePort·DB/PVC를 유지한다. 현재 값은 SSO 인증을 활성화하고 테스트 사용자 모드를 끈다. 업무 기록은 public 스키마를 사용하며 기존 otb_preview 테스트 원장은 이동하지 않는다.

2026-10-13 앱 배포부터 기존 SSO 클라이언트·UI·Ingress 프록시·Helm 설정을 main CI에 포함한다. 별도 `platform-auth` SSO/공유 Redis 릴리스는 유지한다. 배포 후 검증은 인증 활성화·미인증 401·IdP 302 리다이렉트 및 익명 발송/카운트다운 자산을 확인한다. 실제 사용자 로그인 후 칭찬 발송 검증과는 구분한다.

동시 빌드를 막고 배포 직전 최신 main과 커밋을 비교한다. 테스트 실패는 배포하지 않는다. Helm rollout 실패는 `--atomic`으로 이전 리비전으로 복원한다. 배포 후 HTTP 확인 실패도 직전 Helm 리비전으로 복원하고 작업을 실패 처리한다. 데이터 스키마의 비가역 변경은 자동 롤백 대상이 아니므로 별도 백업·마이그레이션 설계가 필요하다.

## 최초 설치 및 운영

클러스터 운영자가 한 번 `kubectl apply -f deploy/ci/rbac.yaml`을 실행한다. Jenkins agent의 서비스 계정은 `jenkins/otb-ci`이며 `oneteambooster-preview`에만 배포 권한을 부여한다. 다른 앱 네임스페이스에 대한 수정 권한은 없다. Helm 릴리스 저장을 위해 해당 namespace의 Secret 관리 권한이 포함된다.

`deploy/ci/job.xml`은 Pipeline from SCM 작업 생성용 초기 설정이다. 기존 작업을 일괄 덮어쓰는 용도로 사용하지 않는다. Jenkins Kubernetes cloud `Wonik`을 사용한다. 배포 대상·트리거 변경은 Jenkinsfile과 이 문서를 함께 수정한다.

장애는 Jenkins의 실패 stage 및 console에서 확인한다. API 키·직원 행·자격 증명 내용을 로그에 출력하지 않는다. 이전 배포로 수동 복원할 때는 `helm history otb -n oneteambooster-preview`에서 리비전을 확인한 뒤 `helm rollback otb <revision> -n oneteambooster-preview --wait`를 실행한다. 자동 배포를 잠시 중단하려면 이 Jenkins 작업을 비활성화한다.

## 2026-09-21 TLS 갱신

사용자가 제공한 `NginX` 인증서로 아래 TLS Secret의 인증서와 키를 갱신했다. 원본은 원격 `/home/admin/.local/share/otb-ops/tls-20260921/backup-20260921T021308Z`에 접근 제한으로 보관했다. 인증서·개인키 폴더는 Git 및 이미지에 포함하지 않는다.

- `harbor/harbor-root-ca`
- `ingress-nginx/global-tls-secret`
- `jenkins/jenkins-root-ca-secret`
- `monitoring/monitor-root-ca-secret`
- `wonix/wonix-root-ca-secret`

제공된 wildcard 인증서 만료는 **2026-11-20 23:59:59 UTC**다. 여섯 도메인(`wonix-ops`, `wonix-cicd`, `wonix-alert`, `wonix-pro`, `stage-wonix`, `wonix`의 `.ips.co.kr`)에서 신뢰 체인·호스트명·새 SHA256 fingerprint를 실제 확인했다. K3s 내부 CA와 `k3s-serving`은 용도가 달라 교체하지 않았다.

갱신 도구 `deploy/rotate-ingress-tls.py`는 지정된 다섯 Secret에 한해 키 일치·유효기간을 검증하고 백업 후 resourceVersion 조건으로 수정한다. 다른 인증서 갱신에 재사용하려면 대상과 fingerprint를 먼저 검토한다.

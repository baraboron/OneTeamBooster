# main 자동 배포

2026-09-21 14:17 KST에 사용자 요청으로 로컬 작업본의 Supabase AI 게이트웨이 연동을 수동 배포했다(Helm 11, `gateway-20260921-141403`). 게이트웨이 설정과 소스를 main 자동 배포 대상에 포함한다. Jenkins는 게이트웨이 단위 테스트와 배포 후 AI 활성화 상태도 검증한다. 검증·이미지·운영 절차는 [OPENAI_GATEWAY.md](OPENAI_GATEWAY.md) 참고.

- Git: https://github.com/baraboron/OneTeamBooster (main)
- Jenkins: https://wonix-cicd.ips.co.kr/job/OneTeamBooster-main/
- 서비스: http://192.168.20.72:30081
- 대상: `oneteambooster-preview` / Helm release `otb`

`Jenkinsfile`은 main을 1분 간격으로 폴링한다. 최초 실행 이후 트리거가 등록된다. GitHub에서 사내 Jenkins로 연결되는 webhook이나 외부 포트 개방은 필요하지 않다. 첫 실행과 자동 변경 감지 확인 결과는 `VALIDATION.md`에 기록한다.

순서는 main checkout → 프런트/백엔드 단위검증 → 임시 PostgreSQL 통합검증 → Helm lint 및 클러스터 dry-run → Harbor 이미지 push → Helm atomic upgrade → 실제 HTTP 확인이다. 빌드마다 임시 Kubernetes Pod를 사용하며 호스트 Docker 소켓이나 privileged 컨테이너를 사용하지 않는다. 임시 DB는 Pod의 loopback에서만 접속하고 Pod 종료 시 삭제한다.

이미지는 `wonix-ops.ips.co.kr/library/oneteambooster-{frontend,backend}:<commit12>-<build>`로 올리고, 실제 배포는 registry digest로 고정한다. 기존 인증서 검증을 유지한다. `library`는 현재 공개 프로젝트이며 앱 이미지에는 직원 데이터·인증서·비밀번호를 포함하지 않는다. 빌드 자격 증명은 기존 `jenkins/harbor-credentials` Secret을 읽기 전용으로 사용한다.

`deploy/values-preview.yaml` 위에 `deploy/values-ci.yaml`을 적용한다. 기존 NodePort, 두 테스트 사용자, DB/PVC와 분리된 테스트 원장을 유지한다. 정식 인증은 여전히 미구현이다.

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

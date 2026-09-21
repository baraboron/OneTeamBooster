#!/usr/bin/env bash
set -euo pipefail
mkdir -p tmp/ci/bin
cd tmp/ci
curl --fail --silent --show-error --location --retry 3 -o helm.tar.gz https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz
curl --fail --silent --show-error --location --retry 3 -o helm.sha256 https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz.sha256sum
awk '{print $1 "  helm.tar.gz"}' helm.sha256 | sha256sum --check
tar -xzf helm.tar.gz linux-amd64/helm
mv linux-amd64/helm bin/helm
curl --fail --silent --show-error --location --retry 3 -o bin/kubectl https://dl.k8s.io/release/v1.34.5/bin/linux/amd64/kubectl
curl --fail --silent --show-error --location --retry 3 -o kubectl.sha256 https://dl.k8s.io/release/v1.34.5/bin/linux/amd64/kubectl.sha256
printf '%s  bin/kubectl\n' "$(cat kubectl.sha256)" | sha256sum --check
chmod 755 bin/helm bin/kubectl
cat > kubeconfig <<'YAML'
apiVersion: v1
kind: Config
clusters:
  - name: k3s
    cluster:
      server: https://kubernetes.default.svc
      certificate-authority: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
users:
  - name: otb-ci
    user:
      tokenFile: /var/run/secrets/kubernetes.io/serviceaccount/token
contexts:
  - name: otb
    context:
      cluster: k3s
      user: otb-ci
      namespace: oneteambooster-preview
current-context: otb
YAML
bin/helm version --short
bin/kubectl version --client

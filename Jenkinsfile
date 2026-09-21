pipeline {
  agent {
    kubernetes {
      cloud 'Wonik'
      defaultContainer 'tools'
      yamlFile 'deploy/ci/agent.yaml'
    }
  }
  options {
    disableConcurrentBuilds()
    timeout(time: 25, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    skipDefaultCheckout(true)
  }
  triggers { pollSCM('* * * * *') }
  environment {
    REGISTRY = 'wonix-ops.ips.co.kr/library'
    KUBECONFIG = "${WORKSPACE}/tmp/ci/kubeconfig"
    TEST_DATABASE_URL = 'postgresql://otb@127.0.0.1:5432/otb_test'
  }
  stages {
    stage('Checkout main') {
      steps {
        script {
          def revision = checkout scm
          env.GIT_COMMIT = revision.GIT_COMMIT
          env.IMAGE_TAG = "${env.GIT_COMMIT.take(12)}-${env.BUILD_NUMBER}"
          currentBuild.description = "main ${env.GIT_COMMIT.take(12)}"
        }
        sh 'test "$(git rev-parse HEAD)" = "$GIT_COMMIT"'
      }
    }
    stage('Tests and chart validation') {
      steps {
        sh 'bash deploy/ci/prepare.sh'
        sh 'node --test *.test.js'
        sh 'npm --prefix backend ci --ignore-scripts && npm --prefix backend test'
        sh 'node deploy/ci/wait-database.mjs && node --test backend/integration.test.js'
        sh '''
          tmp/ci/bin/helm lint deploy/helm/oneteambooster --strict -f deploy/values-preview.yaml -f deploy/values-ci.yaml
          tmp/ci/bin/helm template otb deploy/helm/oneteambooster -n oneteambooster-preview \
            -f deploy/values-preview.yaml -f deploy/values-ci.yaml \
            --set-string frontend.image.tag="$IMAGE_TAG",backend.image.tag="$IMAGE_TAG" > tmp/ci/rendered.yaml
          tmp/ci/bin/kubectl -n oneteambooster-preview apply --dry-run=server -f tmp/ci/rendered.yaml
        '''
      }
    }
    stage('Build and push frontend') {
      steps {
        container('build-frontend') {
          sh '/kaniko/executor --context "$WORKSPACE" --dockerfile "$WORKSPACE/deploy/frontend.Dockerfile" --destination "$REGISTRY/oneteambooster-frontend:$IMAGE_TAG" --digest-file "$WORKSPACE/tmp/ci/frontend.digest" --cache=false --verbosity=warn'
        }
      }
    }
    stage('Build and push backend') {
      steps {
        container('build-backend') {
          sh '/kaniko/executor --context "$WORKSPACE" --dockerfile "$WORKSPACE/deploy/backend.Dockerfile" --destination "$REGISTRY/oneteambooster-backend:$IMAGE_TAG" --digest-file "$WORKSPACE/tmp/ci/backend.digest" --cache=false --verbosity=warn'
        }
      }
    }
    stage('Deploy to K3s') {
      steps {
        sh 'bash deploy/ci/deploy.sh'
      }
    }
  }
  post {
    success { echo 'Verified deployment: http://192.168.20.72:30081' }
    failure { echo 'Build failed. Check the failed stage; Helm deployment failures roll back automatically.' }
  }
}

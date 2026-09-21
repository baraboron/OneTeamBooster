ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine@sha256:daa17b944bac2b578e962da4c61ad72a59233b3c63abea17113acaf4e6b9aea4
FROM ${NGINX_IMAGE}
# Allowlist browser assets: never copy repository docs, credentials or backend sources.
COPY index.html styles.css app.js ui.js leader.js leader-domain.js home.js home-domain.js home-config.js leaderboard-client.js motivation-templates.js praise-copy.js api-client.js employee-picker.js test-workspace.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY deploy/helm/oneteambooster/files/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

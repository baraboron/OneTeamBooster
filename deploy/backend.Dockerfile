ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node backend/*.js backend/schema.sql ./
COPY --chown=node:node backend/scripts/ ./scripts/
USER node
EXPOSE 3000
CMD ["node", "server.js"]

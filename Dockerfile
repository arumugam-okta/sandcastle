# Hosted on the Okta app platform: one container, one port ($PORT, 8080). The control plane serves
# the launcher UI + API and proxies each user's template process under /preview/<template>/.
# Base image digest is the platform-audited wolfi-base (see apps_build_template).
FROM cgr.dev/chainguard/wolfi-base@sha256:03c6561658909fc4eadd0b2dc717375df40a22cc05455b8f82f1f1974e7e4427 AS build
RUN apk add --no-cache nodejs-24 npm
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM cgr.dev/chainguard/wolfi-base@sha256:03c6561658909fc4eadd0b2dc717375df40a22cc05455b8f82f1f1974e7e4427
RUN apk add --no-cache ca-certificates nodejs-24 npm
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY templates ./templates
COPY --from=build /src/dist ./dist
RUN mkdir -p /data/workspaces && chown -R nonroot:nonroot /data /app
USER nonroot
ENV PREVIEW_MODE=path PORT=8080 HOME=/tmp WORKSPACES_DIR=/data/workspaces
EXPOSE 8080
CMD ["node", "server/index.js"]

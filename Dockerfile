# Control plane: builds the launcher UI and runs the API + preview gateway.
FROM node:22-slim AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:22-slim
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY templates ./templates
COPY --from=build /src/dist ./dist
ENV RUNTIME=docker WORKSPACES_DIR=/data/workspaces
EXPOSE 4100 4101 4102 4103
CMD ["node", "server/index.js"]

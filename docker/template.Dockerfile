# One image per template: dependencies are installed at build time, the user's workspace
# (source + .env) is bind-mounted at /app at run time. Build with scripts/build-templates.sh.
FROM node:22-slim
ARG TEMPLATE
ARG NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
WORKDIR /opt/deps
COPY templates/${TEMPLATE}/package.json ./
RUN npm install --no-audit --no-fund && chown -R node:node /opt/deps
WORKDIR /app
USER node
# The mounted workspace has no node_modules; link the baked-in ones, then start the app.
CMD ["sh", "-c", "ln -sfn /opt/deps/node_modules /app/node_modules && npm start"]

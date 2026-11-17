# syntax=docker/dockerfile:1

# Builds apps/__APP_NAME__ from the repo root (`docker build -f apps/__APP_NAME__/Dockerfile .`, as
# compose.yaml does), so the workspace packages it uses come with it. Dockerfile.dockerignore,
# beside this file, keeps node_modules, builds and secrets out.

FROM node:__NODE_MAJOR__-slim AS base
ENV HUSKY=0 CI=true
# The store is a BuildKit cache, kept between builds.
RUN npm install --global pnpm@__PNPM_VERSION__ \
  && pnpm config set store-dir /pnpm-store --global
WORKDIR /repo

# Everything the lockfile names, into pnpm's store, from just the lockfile: this layer is reused
# until a dependency changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store pnpm fetch
COPY . .
# Only this app and the workspace packages it uses. Lifecycle scripts are for development
# (husky, agent config); the build runs what it needs itself.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
  pnpm install --frozen-lockfile --offline --ignore-scripts --filter __APP_NAME__...

# Applies the migrations (the compose `migrate` service), then exits. Only drizzle-kit, the
# Postgres driver, the config and the SQL, at the versions the app installed.
FROM base AS migrate
WORKDIR /migrate
RUN --mount=type=bind,from=deps,source=/repo,target=/repo \
  --mount=type=cache,target=/root/.npm \
  version() { node -p "require('/repo/apps/__APP_NAME__/node_modules/$1/package.json').version"; } \
  && npm install --no-save --ignore-scripts \
    "drizzle-kit@$(version drizzle-kit)" \
    "drizzle-orm@$(version drizzle-orm)" \
    "pg@$(version pg)"
COPY apps/__APP_NAME__/drizzle.config.ts ./
COPY apps/__APP_NAME__/drizzle ./drizzle
CMD ["node_modules/.bin/drizzle-kit", "migrate"]

# Builds the Nitro server into .output/, which has every dependency it needs.
FROM deps AS build
# The install above left the root's own tools out, so pnpm's check that the workspace is
# installed would reinstall it; it is as installed as the build needs.
RUN pnpm --config.verify-deps-before-run=false --filter __APP_NAME__ build

FROM node:__NODE_MAJOR__-slim AS runtime
# SERVER_SHUTDOWN_TIMEOUT (seconds) is how long the server lets requests finish after SIGTERM;
# compose's stop_grace_period must be longer.
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  SERVER_SHUTDOWN_TIMEOUT=30
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/__APP_NAME__/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

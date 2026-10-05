FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace configuration and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
# Security backports applied by pnpm at install time (pnpm-workspace.yaml patchedDependencies),
# and the install hook that keeps optional build-tool peers out of the tree (.pnpmfile.cjs).
COPY patches ./patches
COPY .pnpmfile.cjs ./

# Copy all packages and apps (we need the source to build)
COPY packages ./packages
COPY apps/api ./apps/api
COPY scripts ./scripts

# Install dependencies (frozen to ensure consistency)
RUN pnpm install --frozen-lockfile

# Build the API and its dependencies (@mydevtime/domain, @mydevtime/shared)
RUN pnpm --filter @mydevtime/api... build
RUN cp -r apps/api/src/db/migrations apps/api/dist/db/migrations
# Ship the invoice PDF fonts next to the compiled module (tsc doesn't copy assets).
RUN cp -r apps/api/src/modules/billing/export/fonts apps/api/dist/modules/billing/export/fonts

# Deploy only the API and its prod dependencies into a clean directory
# The API's prod subtree contains none of the patched packages (patches/ backports
# client-bundle deps), so allow unused patches for this one step only — globally a
# patch that silently stops applying must stay an error.
RUN pnpm deploy --legacy --filter @mydevtime/api --prod --config.allow-unused-patches=true /prod/api

# ---------------------------------------------------------
FROM node:22-alpine AS runner

# Pull Alpine's security fixes, which land before the official node image is
# rebuilt, and drop the package managers the server never runs: npm, corepack and
# yarn bring their own dependency trees (and CVEs) into the image. The container
# only ever runs `node dist/main.js` / `node dist/db/migrate.js` (ADR-0078).
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

# Copy the deployed application from the builder
COPY --from=builder /prod/api .

# Run as the unprivileged `node` user (present in the base image), not root.
USER node

EXPOSE 3000

# Serve only — migrations are a separate one-off release step (the compose
# `migrate` service / a k8s Job / `node dist/db/migrate.js`), never run by every
# replica on boot (that couples release+run and races N migrators, 12-factor VI).
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace configuration and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

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
RUN pnpm deploy --legacy --filter @mydevtime/api --prod /prod/api

# ---------------------------------------------------------
FROM node:22-alpine AS runner

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

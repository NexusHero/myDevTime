FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace configuration and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy all packages and apps
COPY packages ./packages
COPY apps/mobile ./apps/mobile
COPY scripts ./scripts

# Install dependencies
RUN pnpm install --frozen-lockfile

# Export the Expo web app
WORKDIR /app/apps/mobile
RUN pnpm run export:web

# ---------------------------------------------------------
FROM nginx:alpine AS runner

# Copy nginx config
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built web static files to nginx html directory
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

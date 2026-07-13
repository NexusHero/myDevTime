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

# The API base URL is inlined into the static bundle at export time (EXPO_PUBLIC_*).
# Default points at the web container's own origin, whose nginx proxies /api → api:3000,
# so the built app talks to the real backend (not the demo path). Override at build:
#   docker build --build-arg EXPO_PUBLIC_API_URL=https://api.example.com ...
ARG EXPO_PUBLIC_API_URL=http://localhost:8080
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

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

# SaaSyToad Forge agent-service: long-running Fastify WebSocket server.
# Build context MUST be the repo root (it needs packages/shared and the workspace lockfile):
#   docker build -f apps/agent-service/Dockerfile -t forge-agent .
FROM node:22-slim

# pnpm via corepack, pinned to the workspace version.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first so the install layer caches well. All package.json files
# are needed for pnpm to resolve the workspace; the filter limits what actually installs.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/agent-service/package.json ./apps/agent-service/
COPY apps/web/package.json ./apps/web/

# Install only the agent-service and its workspace dependencies (keeps the image lean).
# NODE_ENV is intentionally unset here so devDependencies (tsx) are installed.
RUN pnpm install --frozen-lockfile --filter "@forge/agent-service..."

# Source for the agent-service and its shared package.
COPY packages/shared ./packages/shared
COPY apps/agent-service ./apps/agent-service

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# The server binds 0.0.0.0 and drains on SIGTERM. tsx runs the TypeScript entry directly.
HEALTHCHECK --interval=30s --timeout=3s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@forge/agent-service", "start"]

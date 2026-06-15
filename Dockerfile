# Agent service (Fastify): websockets + agent loop + sandbox orchestration.
# Deploy target: Railway / Fly.io. The web app deploys separately to Vercel.
FROM node:22-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install workspace deps (the .dockerignore keeps node_modules/.next out of the context).
COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

CMD ["pnpm", "--filter", "@forge/agent-service", "start"]

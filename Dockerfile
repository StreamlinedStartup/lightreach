# syntax=docker/dockerfile:1
#
# Multi-stage build for Lightreach (pnpm workspaces + Turborepo + Next.js 16 standalone).
#
# Stages:
#   base    - Debian-slim + pnpm + native build toolchain (better-sqlite3, sharp)
#   deps    - install workspace dependencies (cached while lockfile is unchanged)
#   build   - full source + `pnpm build` (turbo -> next build w/ output: "standalone")
#             also reused as the one-shot migration runner (has drizzle-kit + source)
#   runner  - slim runtime image: only the standalone server output, no build tools

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS base
# python3/make/g++ are required to build the better-sqlite3 native addon; sharp
# ships prebuilt binaries but still benefits from a glibc (Debian) base.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build
# `pnpm build` imports the Drizzle client at module load (page-data collection),
# which opens/creates apps/web/data.db as a side effect and Next's output-file
# tracer then copies it into .next/standalone. That's harmless: it's dockerignored
# from this build context, so only a fresh empty file gets created here, and the
# runner always overrides DATABASE_URL to point at the mounted volume instead.

# --- runtime image -----------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output mirrors the monorepo layout because
# outputFileTracingRoot points at the repo root (see apps/web/next.config.ts).
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

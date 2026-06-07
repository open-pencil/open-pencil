# syntax=docker/dockerfile:1.7
#
# Pencil Editor — production image (API + Vite SPA をひとつの Bun process で配信)
#
# build:
#   docker build -t pencil-editor .
#
# run:
#   docker run -p 3001:3001 \
#     -e INKLY_API_AUTH_SECRET=... \
#     -e INKLY_API_JWT_SECRET=... \
#     -e TURSO_DATABASE_URL=libsql://... \
#     -e TURSO_AUTH_TOKEN=... \
#     pencil-editor

FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /app

# 全 file コピー (monorepo の workspace 構造を維持)
COPY . .

# 依存 install (monorepo root から、 workspace 全部にまたがる)
RUN bun install --frozen-lockfile

# build (packages の dist + Vite SPA)
RUN bun run build:packages
RUN bunx vite build

# ─────────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS runtime

WORKDIR /app

# builder ステージ全体を最小コピー (multi-stage で余計なものは捨てる)
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/bun.lock /app/bun.lock
COPY --from=builder /app/packages /app/packages

ENV NODE_ENV=production
EXPOSE 3001

# 起動時に migration 適用してから API server
CMD ["sh", "-c", "bun run packages/api/src/db/migrate.ts && bun run packages/api/src/server.ts"]

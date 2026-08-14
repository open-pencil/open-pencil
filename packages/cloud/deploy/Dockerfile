FROM oven/bun:1.3.10-alpine

WORKDIR /app

COPY package.json bun.lock ./
COPY packages packages
COPY tools/docs/package.json tools/docs/package.json
RUN bun install --frozen-lockfile --filter @open-pencil/cloud

ENV NODE_ENV=production
EXPOSE 8787

CMD ["bun", "packages/cloud/src/runtime/node/main.ts"]

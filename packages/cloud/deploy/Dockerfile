FROM oven/bun:1.4.0-alpine AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY packages packages
COPY tools/docs/package.json tools/docs/package.json
RUN bun install --frozen-lockfile --filter @open-pencil/cloud \
  && bunx tsdown --config packages/cloud/tsdown.standalone.config.ts \
  && bun --filter @open-pencil/cloud build:admin

FROM oven/bun:1.4.0-alpine AS runtime

RUN apk upgrade --no-cache \
  && addgroup -S openpencil \
  && adduser -S -G openpencil openpencil

WORKDIR /app

COPY --from=builder --chown=openpencil:openpencil /app/packages/cloud/dist-standalone ./packages/cloud/dist
COPY --from=builder --chown=openpencil:openpencil /app/packages/cloud/dist/admin ./packages/cloud/dist/admin

USER openpencil

ENV NODE_ENV=production
EXPOSE 8787

CMD ["bun", "packages/cloud/dist/server.mjs"]

FROM oven/bun:1.4.0-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY packages packages
COPY tools/docs/package.json tools/docs/package.json
RUN bun install --frozen-lockfile --filter @open-pencil/cloud \
  && bun --filter @open-pencil/cloud build

FROM oven/bun:1.4.0-alpine AS production-dependencies

WORKDIR /app

COPY package.json bun.lock ./
COPY packages packages
COPY tools/docs/package.json tools/docs/package.json
RUN bun install --frozen-lockfile --production --filter @open-pencil/cloud \
  && rm -rf node_modules/.bun/@typescript+native-preview-* node_modules/@typescript/native-preview

FROM oven/bun:1.4.0-alpine AS runtime

RUN apk upgrade --no-cache \
  && addgroup -S openpencil \
  && adduser -S -G openpencil openpencil

WORKDIR /app

COPY --from=production-dependencies --chown=openpencil:openpencil /app/node_modules ./node_modules
COPY --from=builder --chown=openpencil:openpencil /app/packages/cloud/package.json ./packages/cloud/package.json
COPY --from=builder --chown=openpencil:openpencil /app/packages/cloud/dist ./packages/cloud/dist

USER openpencil

ENV NODE_ENV=production
EXPOSE 8787

CMD ["bun", "packages/cloud/dist/runtime-node.mjs"]

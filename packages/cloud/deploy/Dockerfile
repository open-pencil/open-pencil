# syntax=docker/dockerfile:1
# OpenPencil Cloud: the server and the editor and pages it serves. Build from the repository root,
# with the HTML engine's WebAssembly module built first, which needs Rust (the image has none):
#   bun run --filter @open-pencil/html-engine build:wasm
#   docker build -f packages/cloud/deploy/Dockerfile -t openpencil-cloud .
# The image also runs the services server: `docker run … openpencil-cloud node services.mjs`.

# The build's output is JavaScript and static files, so it runs on the builder's own platform
# once, whichever platforms the image is for, with Bun for that platform too. Playwright's
# Chromium draws the demo document.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS bun

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /src
# The context carries the HTML engine's WebAssembly module, built beforehand (above).
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build:packages
RUN bun run build:cloud
RUN bun --filter @open-pencil/cloud build:standalone

FROM node:22-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
ENV NODE_ENV=production \
    OPENPENCIL_CLOUD_SITE_DIR=/app/site \
    HOST=0.0.0.0 \
    PORT=8787
WORKDIR /app
COPY --from=build /src/packages/cloud/dist-standalone ./
COPY --from=build /src/dist-cloud ./site
COPY packages/cloud/LICENSE packages/cloud/NOTICE ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s \
    CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/ready`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.mjs"]

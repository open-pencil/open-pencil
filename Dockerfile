FROM oven/bun:1 AS base

WORKDIR /app

# Copy workspace package manifests first for better layer caching
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/mcp/package.json packages/mcp/package.json
COPY packages/acp/package.json packages/acp/package.json
COPY packages/docs/package.json packages/docs/package.json

RUN bun install --frozen-lockfile

# Copy source code
COPY . .

EXPOSE 1420

# Vite dev server — bind to 0.0.0.0 so it's accessible outside the container
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]

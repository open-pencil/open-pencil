## Context

OpenPencil is a Bun workspace monorepo with packages at `packages/*`. All Vue components have `data-test-id` attributes (merged in `3ac016b`), enabling reliable CSS-selector-based automation. Webreel (`webreel` npm package v0.1.4) records scripted browser demos from JSON config files using headless Chrome + ffmpeg (both auto-downloaded to `~/.webreel`).

The Vite dev server runs at `http://localhost:1420/`. Demo recording requires the dev server to be running.

## Goals / Non-Goals

**Goals:**
- Standalone `packages/demos` workspace package with webreel as npm dependency
- JSON scenario configs targeting `data-test-id` selectors in the running app
- `bun run demo:record` / `bun run demo:record <name>` from project root
- Zero video artifacts in git — all output gitignored
- Starter scenario proving the pipeline works

**Non-Goals:**
- CI-based automated recording (future work — needs headless Chrome + running dev server)
- Editing or compositing videos beyond what webreel provides
- Replacing Playwright E2E tests — demos are for marketing/docs, not testing

## Decisions

### 1. npm dependency from our fork

Our webreel fork is published on npm as `@sld0ant/webreel-fork@0.1.5` and `@sld0ant/webreel-fork-core@0.1.5` (forked from [vercel-labs/webreel](https://github.com/vercel-labs/webreel) with deterministic headless recording fixes). Using npm is cleaner than git/file deps — proper semver, works on any machine.

Alternative: `git+https://` dependency — rejected because dist/ is gitignored in the webreel repo, Bun can't build from source.
Alternative: `file:` dependency — rejected because it only works on one machine.

### 2. Separate `packages/demos` workspace package

Keeps demo infrastructure isolated from the app, core, CLI, and docs. The package is `private: true`, never published. Only dependency is `webreel`.

Alternative: Put configs in project root — rejected because it clutters the root and isn't consistent with the existing packages/* pattern.

### 3. Wrapper script in `packages/demos/scripts/record.ts`

A thin Bun script that:
1. Invokes `bunx webreel record [names...]` with the correct config path
2. Supports `--all` or specific scenario names as arguments

This avoids issues with webreel expecting Node.js — `bunx` runs the published CLI entry point which has `#!/usr/bin/env node` but Bun handles it fine.

### 4. Scenarios target `data-test-id` selectors

Using `[data-test-id="toolbar-tool-frame"]` etc. These are stable, purpose-built for automation, and already exist on all components.

### 5. Videos and webreel cache gitignored

Add to root `.gitignore`:
```
packages/demos/videos/
packages/demos/.webreel/
```

## Risks / Trade-offs

- [Dev server must be running] → Document clearly; script could check port 1420 before recording
- [Chrome/ffmpeg download on first run ~500MB] → One-time cost, cached in `~/.webreel`; document in README
- [Webreel 0.1.x is young] → We control the fork at sld0Ant/webreel, can publish fixes independently
- [Demo scenarios break if UI changes] → Scenarios use stable `data-test-id` attrs, not text content

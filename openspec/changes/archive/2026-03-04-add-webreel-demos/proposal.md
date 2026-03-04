## Why

OpenPencil has data-test-id attributes on all Vue components but no automated way to record scripted demo videos showcasing the editor. The webreel project (our fork published as `@sld0ant/webreel-fork` + `@sld0ant/webreel-fork-core` on npm, forked from [vercel-labs/webreel](https://github.com/vercel-labs/webreel)) records browser interactions as MP4/GIF/WebM from JSON scenario configs. Adding a `packages/demos` workspace package with webreel integration lets us define, record, and rebuild demo videos on demand — without storing binary artifacts in git.

## What Changes

- New `packages/demos` Bun workspace package with `webreel` as an npm dependency
- Scenario config files (`*.config.json`) defining demo recordings against `http://localhost:1420/`
- Scripts: `bun run demo:record` (all), `bun run demo:record <name>` (single scenario), wired to root package.json
- `.gitignore` entries for generated video output (`packages/demos/videos/`, `packages/demos/.webreel/`)
- A starter demo scenario exercising toolbar tool switching (leveraging existing `data-test-id` attributes)

## Capabilities

### New Capabilities
- `demo-recording`: Webreel-based demo recording infrastructure — scenario configs, record scripts, gitignore for outputs

### Modified Capabilities
- `tooling`: Add `demo:record` scripts to root package.json, document demos workflow

## Impact

- New workspace package `packages/demos` — no changes to existing source code
- New npm dependency: `@sld0ant/webreel-fork` (CLI + core, pulls Chrome + ffmpeg on first run to `~/.webreel`)
- Root `package.json`: new scripts for demo recording
- `.gitignore`: exclude generated videos and webreel cache
- AGENTS.md: document demos workflow

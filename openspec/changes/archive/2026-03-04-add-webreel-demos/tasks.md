## 1. Package Setup

- [x] 1.1 Create `packages/demos/package.json` (private, type: module, `@sld0ant/webreel-fork@0.1.6` npm dependency)
- [x] 1.2 Run `bun install` to resolve the new workspace package (root `workspaces: ["packages/*"]` glob covers it)

## 2. Scenario Infrastructure

- [x] 2.1 Create `packages/demos/webreel.config.json` — single config with a `videos` object containing the toolbar demo scenario (idiomatic webreel pattern). Include `$schema` for IDE autocompletion, `outDir: "videos/"`, target `http://localhost:1420/` with `data-test-id` selectors
- [x] 2.2 Create `packages/demos/scripts/record.ts` — wrapper that: checks dev server reachability at :1420 before recording; invokes `node_modules/.bin/webreel record [names...]` with `-c` pointing to the config; passes through `--verbose`/`--watch` flags; handles non-zero exit codes with clear error messages
- [x] 2.3 Create `packages/demos/scripts/list.ts` — parses `webreel.config.json` and prints available video names

## 3. Root Integration

- [x] 3.1 Add `demo:record`, `demo:list`, and `demo:preview` scripts to root `package.json`
- [x] 3.2 Add `.gitignore` entries for `packages/demos/videos/` (generated output) and `packages/demos/.webreel/` (intermediate recording artifacts)

## 4. Documentation

- [x] 4.1 Add demos section to `AGENTS.md` documenting the workflow, commands, conventions, prerequisites (Chrome/ffmpeg auto-downloaded to `~/.webreel`), and that `bun run dev` or `bun run tauri dev` must be running before recording
- [x] 4.2 Create `packages/demos/README.md` with usage, prerequisites, how to add new videos to the config, output format notes (MP4 default, GIF/WebM via `output` field)
- [x] 4.3 Add demos entry to `CHANGELOG.md` Unreleased section

# Fig (`packages/fig`)

`.fig` archive/parser package owning Figma-specific SceneGraph conversion, raw metadata policy, and component/instance interpretation. Core keeps format-neutral IO registration and runtime rendering/font integration.

- `.fig` files use Figma's Kiwi schema and `NodeChange[]` records. Low-level schema/runtime/codec/container helpers live in `packages/kiwi/src/fig/**` and `packages/kiwi/src/schema-runtime/**`; complete `.fig` archive parsing lives here.
- `@open-pencil/fig` owns SceneGraph ⇄ NodeChange conversion in `packages/fig/src/node-change/**`, component/instance interpretation in `packages/fig/src/instance-overrides/**`, and effective raw metadata policy in `packages/fig/src/source-metadata.ts`.
- Core owns `.fig` IO orchestration in `packages/core/src/io/formats/fig/**`, runtime font/glyph integration, workers, and CanvasKit thumbnails. Keep Fig behavior covered by package-local tests and dist smoke.
- Test `.fig` round-trip by exporting and reimporting in Figma when changing file-format behavior.
- Most of the repo's heavy unit tests are fig/IO fixtures (`tests/engine/io/fig/heavy/`, the exhaustive/glyph-blob/variables round-trips, export text/worker). They need the 180s timeout, so run them via `bun run test:unit:heavy` — never by pointing `bun test` at `tests/engine/io` wholesale. See "Running unit tests" in the root `AGENTS.md`.
- Test fixtures (`tests/fixtures/*.fig`) are Git LFS. If no `.fig` fixtures changed, `git push --no-verify` can skip the slow LFS pre-push hook; use regular `git push` when fixtures changed.

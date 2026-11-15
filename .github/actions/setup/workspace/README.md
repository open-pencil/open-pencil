# Workspace setup and release caching

This action installs the manifest-selected Bun version, restores its package download cache, and always runs `bun install`. It does not cache `node_modules` or skip frozen-lockfile installation on a cache hit.

- `lfs: 'true'` pulls Git LFS files first, only those matching `lfs-include` when it is set.
- `packages: 'true'` runs `bun run build:packages` after installing, once the HTML engine's WebAssembly cache is restored.

- `cache-scope` separates independent workflow groups; the default is `workspace`.
- Keys include the runner OS and host architecture, not the cross-compilation target, plus `bun.lock`. Fallbacks preserve scope, OS and architecture.
- `cache-save: 'false'` makes a consumer restore-only. A writer saves immediately after successful installation, using the restore action's primary key, only on an exact-key miss. No dependency cache post-step runs after a long build.
- The desktop matrix designates one writer per host platform. The macOS Intel cross-build and Windows ARM64 cross-build are readers; package publication also reads the desktop Linux cache. This assumes both macOS entries use the same host architecture, as configured with `macos-latest`; revisit writer selection if runner labels change.
- Bun executable caching is disabled explicitly. Dependency caching remains enabled, avoiding a separate executable cache upload lifecycle.

Rust release caching uses `. -> target`: the repository root is the Cargo workspace, and `target` is relative to it. The Rust action retains compiler/environment keys and the explicit target key; different target artifacts must not be mixed.

## Limits

GitHub isolates caches by ref. One release tag cannot restore another tag's caches. The corrected Rust path benefits retries and compatible caches from the default branch, but does not alone make every future release warm. To seed caches for later tags, manually run the existing Build workflow on `master` with the same toolchain/targets. That dispatch does not publish npm packages or create a tagged release; it does run the full desktop build matrix. This change does not schedule or launch such a warm-up automatically.

Other callers retain the default writer behavior. Concurrent writers in the general `workspace` scope may still race; the single-writer policy here is specifically for the desktop release matrix, not a repository-wide cache scheduler.

## Upstream references

- [Rust cache workspace and key configuration](https://github.com/Swatinem/rust-cache#example-usage).
- [setup-bun inputs, including executable caching](https://github.com/oven-sh/setup-bun#inputs).
- [Restore-only cache action](https://github.com/actions/cache/blob/main/restore/README.md).
- [GitHub cache scope restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache).

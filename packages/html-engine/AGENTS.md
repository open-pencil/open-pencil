# HTML engine

Blitz compiled to WebAssembly with a TypeScript host. The Rust crate in `crate/` captures; `src/` loads the module, answers its requests, validates what it returns, and turns captures into styled DOM/CSS documents. Depends on dom-css for that contract and its parser, never the reverse.

- The module and its host share a raw ABI: strings and bytes cross as (pointer, length) through `alloc`/`dealloc`, and results come back through one output buffer read with `output_ptr` (`src/engine.ts`).
- Keep wasm-bindgen out: Blitz's `web-time` pulls in imports that no capture calls, and the host binds them to functions that throw with their name (`unboundImports` in `src/engine.ts`).
- Every export the host calls is listed in `EXPORTS`, which `engineExports` checks the module has when it loads (`src/engine.ts`).
- Every JSON shape the host reads from the module has its Valibot schema in `src/schema.ts`, which `layout` validates against (`tests/engine.test.ts`).
- The engine fetches nothing: Blitz's requests queue in the crate, the host answers each with bytes or `fail`, and `layout` pumps until none is left (`tests/engine.test.ts`).
- A stylesheet in `<head>` blocks rendering until it is answered, so a failed request is answered with empty bytes rather than dropped (`fail` in `crate/src/lib.rs`).
- Each request gets a deadline and an `AbortSignal`, so one that never settles cannot hold the layouts queued behind it (`tests/engine.test.ts`).
- Raster images are answered with an SVG stand-in of their size, and the capture reports what they really were (`tests/engine.test.ts`).
- `bun run build:wasm` rebuilds the module only when the crate, the root `Cargo.toml` and `Cargo.lock`, or `rust-toolchain.toml` change, writes their hash beside it, and checks a current module without Cargo, so only a rebuild needs Rust (`scripts/wasm.ts`).
- CI's `setup-bun` action caches `wasm/` by the same files, so a job compiles Rust only when they change (`.github/actions/setup-bun/action.yml`).
- Before pushing Rust changes, run what CI runs: `bun run check:rust` (rustfmt, and clippy with warnings denied for wasm32 and the host) and `bun run check:licenses` (`cargo deny`, allowlist in `deny.toml`) (the `HTML engine crate` job in `.github/workflows/ci.yml`).
- The release writes the module's third-party notices into `wasm/` before packing, accepting the licenses `deny.toml` allows, and refuses to pack the package without them (`tools/release/release-packages/tests/notices/artifacts.test.ts`).
- `createHTMLEngineRuntime` is a dom-css `CSSRuntime`: it serializes the document into `<body>` with the CSS in `<head>`, pairs elements with captured ones by position, and fills `computedStyle` with every captured property's value (the initial values the capture leaves out filled back in, and the shorthands the importer reads built from longhands) and, when asked, `layout` as the browser runtime records it, before transforms; parsing and serializing stay dom-css's (`tests/runtime.test.ts`).
- With `onFontFace`, the runtime reads the `@font-face` rules of the page's CSS and of every stylesheet it fetches, known by its CSS content type or because CSS imports it, and passes each font they load once per rule, decoded to TrueType or OpenType by the module, to the host before the engine uses it (`tests/runtime.test.ts`).
- Blitz is pinned to a git commit in `crate/Cargo.toml`; fixes to Blitz, Stylo, Taffy, or Parley go upstream, not into a vendored copy here.

# Fig and Kiwi

`@open-pencil/kiwi` owns Kiwi schema, runtime, codecs, containers, and parse helpers without SceneGraph knowledge. `@open-pencil/fig` owns complete `.fig` archive parsing, SceneGraph conversion, metadata policy, component/instance interpretation, and the Figma clipboard format. Core owns format-neutral orchestration, runtime fonts and workers, and thumbnails.

- Keep Kiwi runtime changes minimal; put project policy in wrappers, not in the runtime.
- Figma clipboard envelope encoding, decoding, and bounds belong to `@open-pencil/fig/clipboard`; converting those records to a SceneGraph is `materializeFigFragment` in `packages/fig/src/document/fragment.ts`, which Core drives from `packages/core/src/clipboard/fig-import.ts`. Core prepares runtime fonts and text and owns editor placement and history; browser and Tauri adapters own system clipboard I/O. Do not add platform clipboard APIs here.
- One reader serves every `.fig` path — parse, worker, page population, session recovery, export, and paste — through the document sessions in `packages/fig/src/document/`. Read what it could not resolve with `readerDiagnostics(graph)` from `packages/core/src/kiwi/fig/session/document-state.ts`; do not add a second import path.
- Browser `.fig` export uses fflate and `@open-pencil/fig`; Tauri uses `build_fig_file` in `desktop/`.
- Vector networks use the reverse-engineered `vectorNetworkBlob`; codecs live under `packages/core/src/vector/` and types in Scene Graph.
- Changes to `.fig` behavior require round-trip validation in Figma. `packages/docs/development/roadmap.md` tracks raw metadata coverage and the code map for import/export mapping and schema files.
- Measure a reader change over a whole archive, not one frame: capture before and after with `visual-oracles compare digest --file F --out baseline.json` then `--baseline baseline.json`, and account for every node it reports. `compare interpreted-document` checks one frame against live Figma and will report no change while a rule breaks pages it does not cover.
- A rule about Figma's override or binding semantics holds only where it was observed. Before encoding one, find a second archive or frame that exercises it and confirm the outcome in live Figma; several plausible rules here fit one file and are contradicted by the next.
- Fixtures under `tests/fixtures/*.fig` use Git LFS; use a normal `git push` when they change, and `git push --no-verify` to skip the LFS hook otherwise.
- Tests address the package by alias rather than drilling: `#fig/*` for source, `#fig-tests/*` for shared test helpers, both registered in `tools/checks/architecture/src/steiger-rules/support.ts`.

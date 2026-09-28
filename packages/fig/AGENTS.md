# Fig and Kiwi

`@open-pencil/kiwi` owns Kiwi schema, runtime, codecs, containers, and parse helpers without SceneGraph knowledge. `@open-pencil/fig` owns complete `.fig` archive parsing, SceneGraph conversion, metadata policy, component/instance interpretation, and the Figma clipboard format. Core owns format-neutral orchestration, runtime fonts and workers, and thumbnails.

- Keep Kiwi runtime changes minimal; put project policy in wrappers, not in the runtime.
- Figma clipboard envelope encoding, decoding, bounds, and SceneGraph import conversion belong to `@open-pencil/fig/clipboard`. Core prepares runtime fonts and text and owns editor placement and history; browser and Tauri adapters own system clipboard I/O. Do not add platform clipboard APIs here.
- Browser `.fig` export uses fflate and `@open-pencil/fig`; Tauri uses `build_fig_file` in `desktop/`.
- Vector networks use the reverse-engineered `vectorNetworkBlob`; codecs live under `packages/core/src/vector/` and types in Scene Graph.
- Changes to `.fig` behavior require round-trip validation in Figma. `packages/docs/development/roadmap.md` tracks raw metadata coverage and the code map for import/export mapping and schema files.
- Fixtures under `tests/fixtures/*.fig` use Git LFS; use a normal `git push` when they change, and `git push --no-verify` to skip the LFS hook otherwise.

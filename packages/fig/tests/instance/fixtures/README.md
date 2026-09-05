# Instance interpreter fixtures

These JSON files contain decoded Figma NodeChanges, not SceneGraph snapshots.

- `accordion-instance-paths.json`: semantic-field reduction of the source closure for instance `7:283` from `shadcn Figma kit (Community).fig`. Tests component selection, distinct repeated labels and outer typography.
- `accordion-source-closure.json`: all decoded fields on the 23 source records reachable through that instance's component references, explicit swaps and children. Blob indexes refer to the original archive; this fixture is for semantic interpretation, not raster or geometry decoding. It retains the stale `7:93` override.
- `stale-chevron-override.json`: source records `7:95`, `7:94`, `94:5438` from the same archive. Figma reports the old `I7:95;7:93` stroke override but its actual vector is `I7:95;94:5438`, with no strokes. The interpreter must not retarget the stale override.
- `saved-swap-paths.json`: semantic fields from a controlled probe exported using Figma's **Save local copy** command. Source component `10965:1259`, replacement `10965:1261`, host `10965:1269`. Instances `10965:1263` and `10965:1266` cover untouched/edited top-level swaps; `10965:1272` and `10965:1276` distinguish nested `swapComponent()` from assigning `mainComponent`. Preserved text is explicitly encoded against the replacement child's GUID.

Oracle checks used the actual Figma Plugin API via figma-use. They establish component/text/binding behavior only. The interpreter currently excludes derived geometry, layout, variable resolution and production materialization. Passing these tests is not a claim of rendering parity.

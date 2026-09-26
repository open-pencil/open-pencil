# Instance interpreter fixtures

These JSON files contain decoded Figma NodeChanges, not SceneGraph snapshots.

- `accordion-instance-paths.json`: semantic-field reduction of the source closure for instance `7:283` from `shadcn Figma kit (Community).fig`. Tests component selection, distinct repeated labels and outer typography.
- `accordion-source-closure.json`: all decoded fields on the 23 source records reachable through that instance's component references, explicit swaps and children. Blob indexes refer to the original archive; this fixture is for semantic interpretation, not raster or geometry decoding. It retains the stale `7:93` override.
- `stale-chevron-override.json`: source records `7:95`, `7:94`, `94:5438` from the same archive. Figma reports the old `I7:95;7:93` stroke override but its actual vector is `I7:95;94:5438`, with no strokes. The interpreter must not retarget the stale override.
- `saved-swap-paths.json`: semantic fields from a controlled probe exported using Figma's **Save local copy** command. Source component `10965:1259`, replacement `10965:1261`, host `10965:1269`. Instances `10965:1263` and `10965:1266` cover untouched/edited top-level swaps; `10965:1272` and `10965:1276` distinguish nested `swapComponent()` from assigning `mainComponent`. Preserved text is explicitly encoded against the replacement child's GUID.

- `name-provenance.json`: reduced Figma save records and live observations for untouched, explicitly equal-to-default, and custom instance names, plus variant-set versus unrelated-component swaps. All store a name; only explicit renames carry a root-targeted name claim. Untouched variant instances use the component-set name. Temporary probe pages were removed after capture.

Oracle checks use the actual Figma Plugin API via figma-use. These reduced fixtures establish specific component/text/binding contracts; they do not establish complete rendering or document-editing parity. Derived-geometry and full-document behavior have separate tests.

## Gold Preview source evidence

The archive-backed `gold-preview.test.ts` uses `tests/fixtures/gold-preview.fig`. In original
Figma file `NmoHzskYNiSKOaRX14bMdw`, source badges `1:1820`, `1:1821`, and `1:1822` report
`characters` overrides. Their placed occurrences under input `1:3503` inherit those claims
without reporting additional local overrides. The badge component `1:935` is remote/read-only.
A separate local probe confirmed equal-to-default text stays overridden after a component edit.
This is why the untouched sibling labels remain `Badge` in the editing test.

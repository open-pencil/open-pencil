# Instance interpretation replacement

This work completely replaces OpenPencil's existing `.fig` reader. The old importer is a temporary development reference, not a supported fallback. Completion requires migrating every consumer and deleting the superseded implementation. There will be no legacy mode, parallel production reader, or post-interpretation repair replay.

The replacement is under construction. The contracts and evidence below describe progress toward that cutover, not a completed reader.

## Cutover boundary

The replacement package-level reader will own document-scoped source indexing, page and component construction, occurrence evaluation, resource/style/variable association, source correspondence, and provenance. Core will own worker transport, runtime font preparation, editor integration, and layout scheduling—not a second interpretation algorithm.

Migration must cover both synchronous and worker entry points:

- `packages/core/src/kiwi/fig/import.ts` currently assembles documents and invokes population.
- `packages/core/src/kiwi/fig/lazy-import.ts` currently invokes the same old population machinery for later pages.
- `packages/core/src/kiwi/fig/parse/worker.ts` and `session/worker.ts` invoke document import; page population and worker transfer contracts must follow the replacement reader.
- Application, CLI, MCP, and automation callers must converge on that reader through their existing format-neutral I/O entry points.

Deletion includes the old import implementation and its instance population, path-resolution, patch replay, derived propagation, and sync-repair machinery under `packages/fig/src/instance-overrides`. Files with independent conversion responsibilities must be assessed function by function; moving old repair code behind a new name does not count as replacement. Obsolete exports and compatibility wrappers are deleted with their callers migrated.

A removal audit must verify that no production caller imports the superseded reader or population functions. Tests preserve externally demonstrated behavior, not obsolete internal counts or repair sequencing.

## Construction order

1. Consolidate provenance ownership and precedence across expansion, binding, and swaps.
2. Build complete document/page assembly using one reusable source index.
3. Validate read/edit/undo/save/reopen and direct rendering against Figma across the fixture corpus.
4. Migrate every entry point, delete old code, and validate lazy/all-page and performance contracts.
5. Finish documentation and review the replacement and deletion together in the integration PR.

## Identity

An occurrence is one use of a source node within a particular instance expansion. Repeated uses of the same source are independent occurrences.

Keep three identities separate:

- **Main component:** the component expanded by an instance.
- **Source correspondence:** the node in an enclosing owner's component expansion that supplies inherited properties. A descendant can have different correspondence for multiple enclosing instance owners.
- **Occurrence address:** the complete sequence of instance-boundary segments and final target, relative to a declaring owner. A terminal source GUID alone is not sufficient.

Ordinary containers do not introduce an instance boundary. Crossing an instance boundary requires an explicit path segment. Names, geometry, and variant-value similarity are not identity mechanisms.

## Values and provenance

An effective value does not establish whether it is overridden.

| Origin | Meaning |
| --- | --- |
| Component default | Inherited unless superseded. |
| Property assignment | A value supplied to a component-property binding; distinguish it from the default even when equal. |
| Explicit path override | A claim declared by an owner against a complete occurrence path. |
| Saved derived data | Effective geometry/typography supplied by the archive; not automatically a user override. |
| Editor mutation | An explicit edit recorded through shared SceneGraph/editor APIs. |

A label explicitly set to `Badge` remains overridden when its component default is also `Badge`. Conversely, a matching inherited label must not be frozen by a value-difference heuristic.

Overrides declared on an instance inside a component are inherited by uses of that component. They are not necessarily reported as new local overrides on those uses. A swap ends correspondence into the previous component's descendants; replacement children belong to the replacement expansion.

## Pipeline

```text
raw records + component-property bindings + full-path overrides
  -> occurrence-local interpretation
  -> effective properties and provenance
  -> real component closure and owner-scoped SceneGraph correspondence
  -> shared mutation/synchronization APIs
  -> full-path override serialization
  -> reload and Figma validation
```

There must eventually be one production interpretation authority. The prototype must not become a new interpreter followed by legacy repair replay.

## Current evidence

- Independent repeated occurrences preserve different labels.
- Source correspondence prevents duplicate nested children during synchronization.
- A recorded swap prevents restoration of the previous component's children.
- Nested text edits survive tested outer-component synchronization and export/reload.
- Assignment-derived visibility survives the tested Gold Preview reload case.
- Explicit equal-to-default text is protected during component synchronization.

### Gold Preview oracle

In Figma file `NmoHzskYNiSKOaRX14bMdw`, source badges `1:1820`, `1:1821`, and `1:1822` report `characters` overrides on their label descendants. Their occurrences under input `1:3503` inherit these claims; the placed badge occurrences report no additional local overrides.

The badge component `1:935` is remote/read-only. Its live mutation was not validated. A separate temporary local Figma probe confirmed that an explicit equal-to-default text override survives a component edit while an unoverridden sibling inherits the changed text. The probe was removed afterward.

Accordingly, the Gold test expects an edited first badge to retain its edit and the other two to retain `Badge`, not inherit a new badge-component label.

## Document assembly status

The replacement now indexes pages, plans component dependencies, allocates source-owned
component/container identities before population, and assembles full pages without invoking
the old importer. Gold can be assembled with unresolved-path reporting enabled. The original
47,102 callbacks included missed component-root keys, not merely stale descendants. Root
addressing and source-root preservation across swaps reduced this to 1,358 callbacks in 23
owner/effective-component/path/reason groups in the latest diagnostic capture. These counts
are evaluation reports, not unique broken scene occurrences; descendant applicability remains
under investigation.

Variable collections, literal values and versioned references are converted. Supported scalar,
paint and mode references are normalized before interpretation, including nested override
payloads. Numeric layout bindings are applied after hierarchy/mode construction. Gold's
imported binding targets resolve, but complete style/resource metadata and effective-value
parity remain unverified.

Occurrence-specific saved text sizes supersede inherited source text-layout caches.
Glyph-affecting edits invalidate the derived text layout unless the mutation supplies its own
replacement. Paint-only edits preserve it. Ordinary and preview mutations share that rule.

Full layout recomputation still differs from Figma; a saved-geometry match must not be
presented as proof of editable-layout correctness. World-space coordinates are required for
cross-application comparisons, and hidden-node geometry must be reported separately.

## Name provenance

Figma-authored save captures in `tests/instance/fixtures/name-provenance.json` distinguish
stored names from explicit root-targeted name overrides. Explicit equal-to-default names
remain protected. An untouched swapped instance adopts the replacement component's name,
or its component set's name for a variant. Binding-driven swaps need the same default-name
resolution as explicit structural swaps. Initial stored names are not globally rewritten.

## Reproducing the property oracle

```sh
bun tools/visual-oracles/src/operations/compare/interpreted-document.ts \
  --file tests/fixtures/gold-preview.fig --node 1:3461 \
  --figma-key NmoHzskYNiSKOaRX14bMdw --output /tmp/gold-oracle
```

Run from the repository root with the matching Figma document open. The command checks file
identity, captures hidden descendants, compares world-space positions, and writes captures,
differences, and diagnostics. It exits nonzero for any difference. This compares selected
properties, not paint, pixels, or successful layout recomputation.

The latest Gold comparison has 887 nodes on both sides, no structural/semantic/visible-geometry
differences, and 338 hidden-geometry differences. This baseline describes the imported scene,
not the edited document after export.

## Saved text rendering

Valid saved glyphs take precedence over available-font reshaping for plain solid text and
supported solid-color style runs. Glyph character indices select run paint. Unsupported
complex run paints or missing indices remain outside this coverage. Actual ligatures,
complex fills, and complete decoration behavior still require acceptance tests.

Text/font/variation/feature and layout-placement edits invalidate cached glyphs unless the
same mutation supplies replacements. Paint-only edits preserve geometry. Font availability
must not be interpreted as verified binary identity: Gold's saved Inter digest matches
Figma's hosted `Inter_1` (3.019), not bundled Inter 4.001. Exact identity reporting is pending.

The saved-glyph visual regression runs against an isolated worktree app and MCP endpoint.
Existing typography/text-path snapshot differences produce identical actual images with and
without this rendering change; their baselines are not updated by this work.

## Editable-document acceptance

The full-document Gold test now uses the new reader on both sides of export. It covers an
Avatar Boolean property edit, undo/redo, preserved `avatar04`/`avatar05`/`avatar06` identities,
and another property edit/undo after reopening. It passes locally. Source correspondence—not
sibling index—locates component-property targets; population restores saved child order.
Swap expansion preserves occurrence-owned component-property references.

Export fixes under validation prevent shared-style double emission, serialize nested component
swaps, use consistent sibling positions, and map INSTANCE_SWAP property values to graph IDs.
These are not evidence that all component-property metadata exports correctly.

Typed `varValue` defaults/assignments and `PROP_REF` parameter entries now survive export.
Figma's Boolean property action was verified by changing the reopened second badge's Avatar
property, then reading visibility in a subsequent RPC after dependent state settled. Variable
and property-reference parameter entries must coexist; emitting only one loses the other.

Root size overrides use the component override key and pre-scale size; placed dimensions stay
separate. Explicit padding, text sizing/grow, and axis-sizing/alignment claims are retained.
Untouched FIG layout payloads preserve implicit-size semantics; explicitly edited fields use
current graph values during export. Remote text style claims retain asset key/version references.
This resolves the tested typography, input width, and stepper collapse but is not complete
style/link/editing fidelity.

### Figma-rendered round-trip evidence

Both comparisons use full 1270×760 PNGs at 1× in sRGB, rendered by Figma on both sides. The
edited oracle is a temporary clone of the original with the same Avatar=false edit; the clone
was removed afterward. Percentages are ImageMagick AE at 2% fuzz, not acceptance thresholds.

| Case | Reopened file key | Differing pixels | Fraction | Avatar visibility | Input size |
| --- | --- | ---: | ---: | --- | --- |
| Unedited | `KuB2hdEwERnJGuLbuhW5I4` | 1,948 | 0.202% | true, true, true | 393.566742 × 39.380260 |
| First avatar hidden | `yCY7fYpOm8DRgRWCj8pt1x` | 1,861 | 0.193% | false, true, true | 378.422394 × 39.380260 |

The original edited input is 378.422363 × 39.380260. Remaining visible differences include
badge/avatar corners, calendar arrows, upload-icon details, and toolbar-button styling. The
explicit test rename still does not survive Figma reopening. These results supersede the
previous broken-layout screenshots; they do not establish exact visual parity or readiness
for production cutover. Captures currently live in temporary diagnostic artifacts and need
maintained reproducible round-trip capture tooling.

## Cross-fixture dependency milestone

Document construction now follows non-internal page content, referenced component trees,
and required ownership ancestors without pulling in unrelated internal siblings. Full source
records remain available separately. Required missing sources are errors; absent preferred
swap choices are reported as external choices, not required rendering dependencies.
`ancestorPathBeforeDeletion` alone is not a deletion flag: live Figma component sets can carry it.
Parent property definitions are resolved within source ancestry while retaining local IDs.

Strict interpretation still rejects unresolved assignment targets. The comparison command's
`--allow-partial-assignments` option explicitly records skipped assignment payloads and exits
nonzero if any are skipped. It never makes missing swap targets or ambiguous paths acceptable.

Material 3 currently assembles only with this partial-assignment acknowledgement: 826 assignment
callbacks (329 distinct reports in the measured run). Toolbar section `58027:76064` matches
1,000 nodes except seven names; section `58823:1686` matches all compared fields across 972
nodes. These checks do not establish pixel fidelity. A diagnostic run measured about 17 seconds
assembly and 3 GB process RSS; performance acceptance is outstanding. Shadcn assembly succeeds
with property-path reports; nuxtui needs reassessment after dependency selection.

## Incremental document sessions

`createFigDocumentSession(bytes)` owns parsed source records and creates page shells.
`loadPage(sourcePageId)` adds selected content and required dependencies to the same graph;
repeated loads are idempotent. Existing component identity, edits, and tested sibling order
survive subsequent loads. Record-based and archive-based one-shot APIs also accept `pageIds`.

Loads buffer graph events until the mutation completes. On action failure, the page-load
journal removes newly created nodes and restores selected existing nodes, instance indexes,
and session lookup maps in place. This is a scoped synchronous contract, not a general-purpose
SceneGraph transaction. Tests cover creation failure and later existing-instance/index mutation.

Observers run after the page is marked loaded. Notification failures raise
`CommittedGraphEventError` with `committed=true`; callers must not interpret that as rollback.
Queued events continue to be attempted, but nanoevents may stop remaining listeners of the
same event when a listener throws. Reentrant loading of another page from a committed event
is tested. The session worker now opens/populates through the replacement reader backend.
Other parse entry points and final old-reader removal remain pending.

### Worker recovery checkpoints

Initial graph and successful page responses carry a checkpoint; the client advances recovery
state only after accepting the matching revision/delta. Stale responses do not mark pages
loaded. Original archive bytes are retained separately for recovery and released with session
ownership. Recovery reconstructs source interpretation and attaches to the existing edited
graph, preserving node identities and the editor's undo manager.

Checkpoints contain source-to-node IDs, loaded-page IDs, and component topology addressed by
full source-identity paths. They do not contain duplicated occurrence property payloads.
Restore rejects missing/duplicate paths, mismatched component identities, and invalid roots.
The measured Gold first-page checkpoint shrank from about 3.58 MB to 174 KB; reconstruction
adds work at recovery time. These are diagnostic measurements, not performance guarantees.

Later-loaded instances reconcile supported live component-field edits, retaining imported
explicit overrides. Nested precedence and undo/redo are tested. Component child addition,
deletion, or reordering is currently rejected before loading another page: structural recovery
is not implemented. This limitation blocks complete production readiness; it is not a legacy
fallback. Checkpoint delivery for large documents and all frontend lifecycle paths still need
acceptance coverage.

## Remaining acceptance gaps

- Complete ownership and precedence of provenance through inheritance, swaps, and re-expansion.
- Materialization of all supported explicit/bound fields; current persistence coverage is partial.
- Saved derived data versus editable layout provenance.
- Figma-side component-property metadata/action fidelity, explicit-name persistence, and broader edit/undo coverage.
- Direct render parity, unsupported-feature diagnostics, lazy/all-page equivalence, and resource/performance limits across the fixture corpus.

Passing text or visibility tests alone does not establish a correct editable document or production readiness.

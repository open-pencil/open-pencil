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
the old importer. Gold can be assembled with unresolved-path reporting enabled. This is not
fidelity acceptance: the 47,102 callbacks observed during assembly include repeated expansion
and must be classified rather than treated as unique errors.

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

## Remaining acceptance gaps

- Complete ownership and precedence of provenance through inheritance, swaps, and re-expansion.
- Materialization of all supported explicit/bound fields; current persistence coverage is partial.
- Saved derived data versus editable layout provenance.
- Gold undo/redo, reloaded avatar/component-property fidelity, and edited-output validation in Figma.
- Direct render parity, unsupported-feature diagnostics, lazy/all-page equivalence, and resource/performance limits across the fixture corpus.

Passing text or visibility tests alone does not establish a correct editable document or production readiness.

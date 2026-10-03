# @open-pencil/scene-graph

Shared OpenPencil design document model.

This package owns `SceneGraph`, `SceneNode`, paint/effect/layout/variable types, graph mutation helpers, source metadata, and model-level utilities. It does not own editor state, UI, file format policy, rendering, or app document I/O.

## Issue #770 proof of concept

Run from the repository root:

```sh
bun run poc:770
bun test packages/scene-graph/tests/document
```

The cross-owner investigation in `tools/dev/document-identity/` writes
`scratch/issue-770/README.md`, raw evidence, and git/Yjs merge scenarios.
It compares identity schemes using the FIG codec and save/reopen path, reproduces
merge conflicts and hierarchy violations, and recommends a staged review-artifact
direction. Package tests independently verify deterministic snapshots across Bun processes.

```ts
import { createSessionIdGenerator, SceneGraph, serializeGraphSnapshot } from '@open-pencil/scene-graph'

const graph = new SceneGraph(createSessionIdGenerator())
const snapshot = serializeGraphSnapshot(graph)
```

The allocator is opt-in. It uses a cryptographically random nonzero uint32
session namespace and an increasing uint32 local counter, retaining Figma's
`sessionID:localID` shape. Nodes, variables, collections, and modes share the
allocator. Loaded identities remain unchanged; allocation skips identities
already in the graph. Existing callers retain the process-local allocator.

The snapshot is an experimental review artifact, not a loadable document format.
Object keys and string-keyed maps sort by UTF-16 code units, without locale rules;
maps become sorted entry arrays. Ordered arrays (layers, paints, modes, and
geometry) retain their order. The set-like `source.editedFields` sorts separately.
Instance overrides use the existing defined/undefined representation.
Byte buffers serialize as numeric arrays. Finite numbers use ECMAScript JSON
formatting with negative zero normalized to zero; no precision rounding occurs.
Optional undefined object fields are omitted. Cycles, non-finite numbers,
unsupported values, and non-string map keys fail rather than silently lose data.
Output is compact JSON with one final newline.

The snapshot includes images, variables, collections, active modes, enabled
libraries, document color space, and preserved FIG schema/version metadata.
It omits `textPicture`, `derivedTextGlyphs`, the derived instance index, events,
and position caches. Other imported source payloads remain included: this proves
determinism for equal represented state, not equivalence between different
renderings or lossless FIG round trips. Lazily unloaded FIG pages are not captured.

Before production adoption:

1. Choose an identity policy. Random 32-bit sessions can collide across processes
   (approximately 1.2% probability among 10,000 sessions). A wider identity scheme
   needs a FIG compatibility mapping; a coordinated session registry needs authority.
2. Retain identities during reload and regeneration. A fresh reconstruction without
   retained IDs still produces a different document; random allocation cannot match
   equivalent nodes by itself. This PoC does not migrate existing documents.
3. Decide whether Yjs or git owns merge resolution. These helpers perform no merges.
4. Decide on a file format separately. Today's FIG exporter still reassigns locally
   authored GUIDs and includes timestamps/thumbnails; this PoC does not change it.

SDK implementation lives in `src/document/`; regression tests in `tests/document/`.
Decision probes and their scope live in `tools/dev/document-identity/README.md`.

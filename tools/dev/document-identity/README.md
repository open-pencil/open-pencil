# Issue #770 decision probes

Run `bun run poc:770` from the repository root after `bun install` and
`bun run build:packages`. Open `scratch/issue-770/README.md` for the complete
generated report; `evidence.json` records observations and `merge/` contains
the six scenarios' inputs and git/Yjs outputs. Probes assert expected outcomes
and exit nonzero when those expectations fail. No production state is modified.

## Decisions clarified

| Question                   | Evidence                                                                                                                                                                               | Recommendation                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity scheme            | Forced 32-bit namespace reuse collides; 100,000 random 64-bit pairs sampled; both numeric schemes round-trip through Kiwi; raw UUIDs need mapping.                                     | Compare random 64-bit GUIDs for compatibility against UUIDv4 with persisted FIG mapping for stronger uniqueness. Do not adopt random 32-bit sessions alone.     |
| Existing documents         | Allocator replacement preserves loaded IDs; actual FIG writing still uses traversal GUIDs; import allocates new runtime IDs and retains saved GUIDs in `source.id`.                    | Preserve existing file identities; explicitly persist new identities; key reviews/references by canonical identity rather than transient runtime IDs.           |
| Git or Yjs authority       | Git cleanly merges independent properties but exposes structural conflicts. Actual Yjs codec converges while concurrent additions can lose parent links and reparents can form cycles. | Yjs owns live sessions; offline git resolutions require an explicit revision/session boundary and graph validation. Never run both as simultaneous authorities. |
| Format or review artifacts | A move produces one structured summary entry; canonical snapshots are repeatable; unchanged FIG exports still differ.                                                                  | Build review artifacts first; choosing an editable format also requires loader, assets, references, and merge rules.                                            |

Random-ID collision probabilities use the birthday approximation, assuming uniform
independent draws. For 32-bit session allocators, the population counts sessions;
for 64-bit random pairs and UUIDv4, it counts individual identities. Sampling does
not establish uniqueness, and all random schemes remain probabilistic.

## Observed outcomes

Two branches forced to reuse session 99 both minted `99:3` for different nodes.
The random-pair probe sampled 100,000 unique 64-bit GUIDs; that is a smoke check,
not proof of uniqueness. At 10,000 independent namespaces/identities, the birthday
approximation gives about 1.157% collision probability for 32-bit sessions versus
2.71e-12 for 64-bit pairs. UUIDv4 offers a larger identity space but does not parse
through the current numeric GUID adapter without a persisted mapping.

An authored node's saved FIG GUID changed when a sibling was inserted before it.
FIG import also allocated fresh runtime IDs while retaining saved GUIDs in
`source.id`. Experimental identity pinning plus saved-GUID normalization of nodes
and parent/child references reduced an actual save/reopen insertion to two review
changes: the new node and its parent's child list. The existing Card had no
spurious review changes. This normalization rejects duplicate saved identities.

| Scenario                         | Git text merge                 | Existing Yjs node representation                              |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Independent nodes                | Clean; both edits retained.    | Converges; both edits retained.                               |
| Different properties of one node | Clean; both edits retained.    | Converges; both edits retained.                               |
| Same property                    | Conflict requiring resolution. | Converges to one winner.                                      |
| Concurrent sibling additions     | Conflict requiring resolution. | Both nodes remain, but one loses its parent child-list entry. |
| Delete versus edit               | Conflict requiring resolution. | Deletion wins; the edit disappears.                           |
| Concurrent reparents             | Conflict requiring resolution. | Converges to a parent cycle and inconsistent hierarchy.       |

The git input is a declared node projection, not a proposed save format. The
Yjs probe exchanges actual binary updates through the app's existing node codec;
these outcomes describe that representation, not an end-to-end room/UI test.
The peer chosen as the winner can vary; the asserted outcomes do not depend on it.

Repeated canonical snapshots of equal represented state were byte-identical.
One position edit changed one numeric token and one structured summary entry.
Repeated unchanged FIG exports differed in metadata and bytes even with the same
placeholder thumbnail, isolating timestamp noise from rendered-thumbnail concerns.

These observations support review artifacts first and an explicit authority
boundary between live Yjs sessions and reviewed offline git resolutions. They do
not establish that either merge mechanism is safe without scene-graph validation.

## Scope

`identity.ts` exercises the bundled Kiwi codec, real FIG export/reimport, an additive
allocator migration, and experimental saved-ID pinning. The pin uses `source.id`
only to establish feasibility: it is not a production implementation because
that field also controls imported-source policies. Document-root normalization
and references need explicit treatment. Clone-based reload checks do not prove
disk identity persistence or regeneration matching.

`merge.ts` runs `git merge-file` on an explicitly limited node projection and real
Yjs binary update exchange using the app's existing node codec. It validates both
branch inputs and checks parent/child consistency and cycles after convergence.
It does not exercise app observers, room transport, rendering, or undo; the report
therefore describes representation-level violations rather than claiming a
verified canvas symptom. Conflict-region counts can vary with git versions and
ID order; scenarios assert material outcomes rather than a particular winner.

`index.ts` produces the report and a small structured review of the move. The
summary projection covers name, type, hierarchy, position, and size. The SDK's
full snapshot is accompanying evidence; neither projection is a loadable format.
Production review summaries must classify all node, variable, asset, and metadata
changes and materialize unloaded FIG pages. Components, variable modes, vector
geometry, image assets, arbitrary import payloads, live Figma fidelity, and a
specified session/revision transition remain adoption gates, not proven outcomes.

The PoC recommends; maintainers choose policy. It does not claim #770 is closed.

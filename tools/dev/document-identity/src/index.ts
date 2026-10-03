import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

import { serializeGraphSnapshot } from '@open-pencil/scene-graph'

import { fixture, fork } from './fixture'
import { probeIdentity } from './identity'
import { probeMerges, projectGraph, semanticChanges } from './merge'

const output = 'scratch/issue-770'
mkdirSync(output, { recursive: true })
function gitOutput(args: string[]): string {
  const result = Bun.spawnSync(['git', ...args])
  assert.equal(result.exitCode, 0, result.stderr.toString())
  return result.stdout.toString().trim()
}
const environment = {
  timestamp: new Date().toISOString(),
  bun: Bun.version,
  git: gitOutput(['--version']),
  repositoryHead: gitOutput(['rev-parse', 'HEAD']),
  workingTreeDirty: gitOutput(['status', '--porcelain']).length > 0
}
const identity = await probeIdentity(output)
const merges = await probeMerges(output)
const { graph, card } = fixture()
const before = serializeGraphSnapshot(graph)
const edited = fork(graph)
edited.updateNode(card.id, { x: 20 })
const after = serializeGraphSnapshot(edited)
graph.nodes = new Map([...graph.nodes].reverse())
assert.equal(serializeGraphSnapshot(graph), before)
assert.equal(after, before.replace('"x":10', '"x":20'))
const changes = semanticChanges(projectGraph(graph), projectGraph(edited))
assert.equal(changes.length, 1)
await Bun.write(`${output}/before.json`, before)
await Bun.write(`${output}/after.json`, after)
await Bun.write(`${output}/review.md`, `${changes.join('\n')}\n`)
await Bun.write(
  `${output}/evidence.json`,
  `${JSON.stringify({ environment, identity, merges }, null, 2)}\n`
)

const table = merges
  .map(
    (row) =>
      `| ${row.name} | ${row.git.conflicts === 0 ? 'Clean' : `${row.git.conflicts} conflict regions`} | ${row.yjs.hierarchyIssues.length ? `Converged; ${row.yjs.hierarchyIssues.length} hierarchy violations` : 'Converged; hierarchy valid'} |`
  )
  .join('\n')
const risk = identity.theoreticalCollisionRisk[0]
const report = `# Issue #770 — decision evidence

Run: \`bun run poc:770\`. All probes assert their expected outcomes and exit nonzero on failure.
Raw observations: [evidence.json](evidence.json). Minimal review: [review.md](review.md).
Scenario inputs and both merge outputs: [merge/](merge/).
Run environment: Bun ${environment.bun}, ${environment.git}; repository head
\`${environment.repositoryHead}\` plus the current PoC working-tree changes.

## Recommendations

1. **Identity: use random 64-bit GUID pairs as the compatibility-first candidate, not random 32-bit sessions.**
   They fit the bundled FIG codec with no UUID mapping. For stronger global guarantees,
   UUIDv4 plus a persisted FIG mapping is the alternative. Neither option matches regenerated
   nodes automatically: authors/generators must retain IDs or stable authoring keys.
2. **Persistence: preserve existing IDs; make the FIG writer persist new node identities.**
   Allocation alone fails the real save/reopen path. Do not renumber legacy documents eagerly.
   Separate persisted identity from freshly allocated runtime IDs, normalize the FIG root deliberately,
   and audit variables, modes, properties, clones,
   and every reference before rollout. Already-diverged legacy branches with colliding IDs
   need explicit reconciliation; a random allocator cannot recover which node was intended.
3. **Authority: keep Yjs authoritative for live sessions; treat git conflicts as explicit offline review decisions.**
   Do not silently import a git merge into an active Yjs session or replay a Yjs winner over a
   reviewed git resolution. A session boundary needs a base revision, a paused/restarted room,
   and an explicit publish/reconciliation operation. This avoids two simultaneous authorities.
4. **Product direction: deliver structured review artifacts before a git-native save format.**
   They satisfy the small-edit review use case without inventing a loader, asset representation,
   or merge protocol. Raw git handles independent edits but cannot resolve concurrent hierarchy
   changes automatically. Current Yjs convergence also needs hierarchy validation/repair.

These are recommendations supported by the probes, not maintainer decisions or a production rollout.

## 1. Which identity scheme and migration?

- Forced reuse of session 99 in two branches minted **${identity.forcedSessionCollision.join(' and ')}**
  for different additions. This is a demonstrated failure mode, not a sampled collision estimate.
- Random 64-bit pairs: **${identity.randomGuidSample.unique}/${identity.randomGuidSample.count} unique**
  in this run. Sampling is a smoke check, not a uniqueness proof.
- Birthday approximation at 10,000 independent allocations/namespaces:
  random 32-bit sessions **${(risk.session32 * 100).toFixed(3)}%**;
  random 64-bit GUIDs **${risk.guid64.toExponential(3)}** probability;
  UUIDv4 **${risk.uuid122.toExponential(3)}** probability.
  For session allocators the count means sessions, while the other counts mean entities.
  This assumes independent uniform randomness; reused seeds/namespaces invalidate it.
- Both numeric schemes survive the exact bundled Kiwi encoder/decoder. A raw UUID does not
  parse to a numeric GUID with today's \`stringToGuid\`; it requires a stored mapping.
- Switching the allocator retained **${identity.migration.existingIdsRetained} existing IDs**.
  A copied in-memory reload produced identical snapshots. This demonstrates an additive
  migration strategy, not a new disk loader or automatic regeneration identity matching.
- Real FIG export wrote Card's runtime ID **${identity.fig.originalId}** as saved GUID
  **${identity.fig.savedGuid}**. Inserting a sibling before it changed its saved GUID to
  **${identity.fig.afterInsertionGuid}**. Therefore the FIG writer still renumbers authored identities.
- Reopen allocated runtime ID **${identity.fig.reopenedId}**, while preserving the saved GUID
  in \`source.id\`. Runtime identity and file identity are separate in the current reader.
- Experimental identity pinning through existing \`source.id\` retained Card as
  **${identity.fig.pinnedCardId}** after save/reopen and **${identity.fig.pinnedCardAfterInsertion}**
  in \`source.id\` after insertion. It proves saved-GUID persistence is feasible with the current codec.
  It is **not** the proposed implementation: \`source.id\` also controls imported-source semantics.
  Prefer a deliberate runtime-ID fallback in the writer. Even with pinned saved GUIDs, runtime IDs
  changed from **${identity.fig.pinnedRuntimeId}** to **${identity.fig.pinnedRuntimeIdAfterInsertion}**.
  Review artifacts must key nodes and references by a stable persisted identity rather than those
  runtime IDs. The root still changed from
  **${identity.fig.rootBefore}** to **${identity.fig.rootAfter}**, which needs an explicit policy.
- Normalizing the two pinned imports by saved GUIDs (including parent/child references and
  FIG's reserved \`0:0\` root) reduced the insertion review to **${identity.fig.persistedReviewChanges.length} changes**:
  the new node and its parent's child list. Card showed no spurious changes despite its fresh
  runtime IDs. See [persisted-review.md](persisted-review.md). This demonstrates the review-key
  strategy on actual save/reopen, not only on cloned in-memory graphs. Duplicate saved GUIDs
  are rejected rather than silently aliasing two nodes. Source-metadata pinning and this
  limited projection remain probe-only; assets and other reference domains require their own mapping.

**Clarified decision:** choose 64-bit compatibility-first IDs or wider IDs with a persistent
mapping; persist identity independently of traversal; retain old IDs and reconcile old collisions.
Live Figma acceptance and a representative archive corpus remain necessary before adopting either.

## 2. Can git or existing Yjs own merges?

The git probe uses actual \`git merge-file\` on pretty JSON keyed by stable node IDs.
The projection includes identity, hierarchy, name, type, position, and size; it is a comparison
artifact, not a proposed format. The Yjs probe uses the app's actual
\`syncEncodedNodeToYMap\`/\`decodeNodeFromYjs\` codec and real binary update exchange.
Each branch begins from a valid hierarchy; merged output is checked for parent/child consistency
and cycles. It does not exercise app observers, room transport, canvas rendering, or undo.

| Scenario | Git text merge | Existing Yjs node representation |
| --- | --- | --- |
${table}

Independent changes survive both mechanisms. Editing the same property produces a git conflict;
Yjs converges to one winner without exposing that conflict. Delete-versus-edit removes the node
in the Yjs result, so the edit disappears. Two distinct sibling additions both remain in the
Yjs node map, but one disappears from the parent's \`childIds\` array. Concurrent reparents create
a cycle. These are failures of the tested representation's document invariants, not failures
of Yjs update convergence.

**Clarified decision:** convergence does not establish a valid scene graph, and clean JSON does
not establish a valid graph either. Choose authority by workflow and enforce a revision/session
boundary; validate hierarchy on every accepted merged state. A shared sequence for child order
can address concurrent additions, but cycle handling and deletion policy still need domain rules.
This PoC records the gaps; it does not change production collaboration behavior.

Primary API references: [Y.Map](https://docs.yjs.dev/api/shared-types/y.map),
[document updates](https://docs.yjs.dev/api/document-updates).

## 3. Git-native format or review artifacts?

- Canonical full-state snapshots stayed byte-identical after reversing node-map insertion order.
  Moving Card changed one numeric token in [before.json](before.json) and [after.json](after.json).
- The structured summary was exactly **${changes.length} change**: \`${changes[0]}\`.
  It avoids reading a whole document or binary FIG archive to assess this change.
- A keyed text projection merged independent edits and separate properties on the same node,
  but required human resolution for the structural scenarios above. Its chosen formatting
  affects conflict granularity; these results do not certify every possible text format.
- Two unchanged FIG exports had different bytes and metadata even with the same placeholder
  thumbnail. Timestamp noise is therefore independently demonstrated; rendered-thumbnail
  nondeterminism and zip timestamp behavior were not isolated here.

**Recommendation:** use canonical snapshots plus structured diffs for review first, keep the
existing save path, and fix persistent GUIDs there before relying on cross-save comparisons.
The concise summary here covers a declared subset of fields; the full snapshot remains the
evidence. A production review artifact must classify all node, variable, image, and metadata
changes. A git-native editable format additionally needs a validated loader, asset policy,
reference integrity, lazy-page materialization, and explicit merge semantics. Neither the
snapshot nor the pretty projection is presented as that format. No \`.pen\` writer is proposed.

## Scope and remaining acceptance

This run uses generated rectangles/frames and real local FIG/codec/git/Yjs paths. It does not
prove Figma visual fidelity, full-document equivalence, arbitrary import metadata coverage,
regeneration identity matching, or production collaboration safety. Before adopting the
recommendations, repeat with components, variable modes, geometry, assets, and lazy imported
pages; verify in live Figma; specify the revision/session boundary and structural merge rules.
The probes make those required decisions concrete rather than claiming #770 is closed.
`
await Bun.write(`${output}/README.md`, report)
process.stdout.write(`Decision probes passed. Open ${output}/README.md\n`)

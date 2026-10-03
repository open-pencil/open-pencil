# Source model

```text
Source archive
  +-- node-change records ----> source index (GUID -> record)
  +-- blobs ------------------> geometry / saved glyph payloads
  +-- images -----------------> content-addressed image resources
  +-- schema/version ---------> decoding and later export

Selected pages
  -> content dependencies -> required component trees
                         -> ownership ancestors, not all their siblings
```

## Vocabulary and identity

| Term | Meaning |
| --- | --- |
| Source record | A node-change record identified by its archive GUID. |
| Component definition | The source tree expanded by an instance. |
| Occurrence | One use of a source node within a particular expansion. |
| Owner | The occurrence whose component scope declares or applies a claim. |
| Claim | A property contribution retaining its origin and target address. |
| Materialized node | An editable SceneGraph node created for an occurrence or source. |

```text
Component A
  +-- nested instance ----------------------> Component B
        +-- Label occurrence
              +-- source: B's Label
              +-- outer correspondence: Label in A's expanded instance
              +-- address within A: [nested instance, Label]

Another use of A -> another Label occurrence, not the same mutable node
```

**Required invariant:** main-component identity, source correspondence, and occurrence address
are distinct. Names, geometry, variant-value similarity, and terminal-GUID matches do not
establish occurrence identity.

```text
Use                  Source node     Owner-relative address
-------------------  --------------  ----------------------
Badge A / Label      1:42            [Badge A, 1:42]
Badge B / Label      1:42            [Badge B, 1:42]
                     ^ same source   ^ different occurrences
```

The names above label the example; real addresses use source identities, not those labels.
Matching only `1:42` loses which occurrence is targeted.

## Resources and dependencies

Variable collections/variables are not scene children. Internal source pages can retain
resources that are not live content. Dependency discovery follows selected page trees,
component references, supported INSTANCE_SWAP defaults/assignments, and preferred choices.
Ownership ancestors do not imply that unrelated siblings must be expanded.

Components the archive no longer contains are reported by the closure as
`missingComponentIds`; broken hierarchy or style references remain fatal `missingIds`. Figma
keeps instances of deleted components, so with `onMissingComponent` the interpreter keeps such
an instance as a childless occurrence that retains its saved reference and reports the owner;
without it, expansion fails. Unavailable preferred choices are recorded separately as external
choices. Neither permits ignoring a missing effective dependency silently.

`ancestorPathBeforeDeletion` alone is **not** a liveness flag: Figma can retain it on live
component sets. Current hierarchy and reference semantics must be considered independently.

## Ownership

- Record-based reading copies caller-supplied records.
- Archive-owned reading takes ownership of records it parses, avoiding a second full tree.
- Exposed source/resource snapshots are copied.
- Evaluations produce independently mutable occurrence data.
- Blob and image references must remain valid across transfer and export.

Do not replace copying with shared mutable objects merely to improve memory measurements.

## Implementation and tests

- [Dependency closure](../src/document/dependency-closure.ts)
- [Component dependencies](../src/document/component/dependencies.ts)
- [Resource references](../src/document/resource-reference.ts)
- [Property-definition ancestry](../src/document/property-inheritance.ts)
- [Closure tests](../tests/document/dependency-closure.test.ts)
- [Deletion-history tests](../tests/document/retained-records.test.ts)
- [Archive ownership tests](../tests/document/archive-assembly.test.ts)

**Known limitation:** reference coverage, retained-resource export, and large-document memory
usage still require corpus-wide acceptance. A discovered dependency closure is not proof that
every record in the archive has been understood.

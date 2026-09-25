# Materialization

```text
source ownership + evaluated occurrences
                  |
       allocate canonical identities
                  |
       populate children in saved order
                  |
       link source correspondence by owner
                  |
       record explicit/bound overrides
                  |
       resolve resources and live edits
                  v
          editable SceneGraph
```

## Construction and correspondence

Canonical page/container/component identities are allocated before dependent instances are
populated. A component referenced from another page must not be duplicated when its own page
loads. Occurrence nodes are mapped by source identity, not names or sibling indexes.

```text
Nested Label's live node
  +-- owner: Inner instance -> original Label in Inner component
  +-- owner: Outer instance -> Label in Outer's expanded Inner instance

One node can need both correspondences for different editing operations.
```

Swapping an instance preserves its role in the enclosing component, including property
references, while changing its main component and descendant expansion. Correspondence into
removed descendants ends at the swap boundary.

Component-property definitions belong to components/sets. Instances retain assignments and
references, not copied definition lists. A variant's `variantPropSpecs` name definitions its
component set owns, so its `componentPropertyValues` resolve to names after the set exists in
the graph, not during occurrence conversion.

Explicit claims are recorded as instance overrides through the shared field registry; a
claimed paint that carries a colour alias also records its `boundVariables` claim. An instance
of a deleted component is materialized as a childless `INSTANCE` with `componentId: null`.

## Editing responsibilities

SceneGraph owns format-neutral override storage and mutation/query helpers. Core's editor owns
undo transactions, layout scheduling, and render invalidation. Import code must not simulate
editing with test-only undo closures or replay repairs after construction.

Later-page loading applies supported live component-field edits only to newly created
occurrences. Explicit destination overrides remain protected. Structural component edits are
currently rejected by the [session](./document-sessions.md) guard rather than replayed from stale
source data.

## Saved geometry and text

**Required invariant:** valid saved text geometry describes the saved appearance. Available
family/style is not proof that reshaping uses the same font binary.

**Implemented:** plain solid text and supported solid-color runs prefer valid saved glyphs.
Character indices associate glyph clusters with style-run paint. Occurrence-derived text sizes
supersede inherited source caches. Text/shaping/layout edits invalidate affected caches unless
the same update supplies replacements; paint-only edits preserve geometry.

**Known limitations:** complex text fills, complete decoration behavior, actual ligature
coverage, and exact font-identity reporting remain incomplete. Saved appearance is not proof
that subsequent layout recomputation or editing is correct.

Retained FIG layout metadata preserves distinctions such as implicit-size Hug. Explicit edits
must take precedence over retained values during [export](./export.md). Raw/pre-scale dimensions
and effective node geometry must not be conflated.

```text
Mutation                   Characters       Saved glyph geometry
-------------------------  ---------------  --------------------
Move node                  unchanged        retain
Change solid fill color    unchanged        retain
Change text                changed          invalidate
Change font variation      unchanged        invalidate
Supply reshaped glyphs     changed or same  replace explicitly
```

This is a cache-validity example, not permission to retain geometry after untested
shaping-affecting changes. The invalidation tests define the implemented coverage.

## Live numeric binding units

Numeric variables stay in their declared units. The FIG materializer records each binding's
conversion to occurrence coordinates in SceneGraph's format-neutral `variableBindingScales`
map. Nested instance factors compose; opacity's percentage conversion is separate from
geometric scale, and rotation is not scaled. The metadata is copied with nodes and retained
through worker transfer rather than reconstructed from current geometry or value ratios.

```text
Token value        Occurrence multiplier        Effective padding
8                  0.8908441663                  7.1267533302
16                 0.8908441663                 14.2535066605
undo -> 8          0.8908441663                  7.1267533302
```

Core editor variable actions resolve aliases and inherited modes, apply changed numeric
values without authoring overrides, and recompute affected layout. Token undo/redo follows
the same path. Explicit node-mode edits and binding changes use that reconciliation too.
The editor and Figma API share the graph-only layout reconciliation under Core's layout domain.
Figma API token/binding methods therefore update headless CLI results too. Direct variable-map
mutations bypass this contract; such callers must arrange reconciliation rather than only repainting.

Legacy variable maps and modern parameter-map aliases participate in field-wise inheritance.
A binding declaration starts in its declaring owner's units, replacing only that field's inherited
conversion. Later enclosing instance scales then compose with it. A node-wide multiplier cannot
represent both cases:

```text
Inherited inner binding:  token 20 × inner 0.5 × outer 0.5 = padding 5
Outer-owner declaration: token 12             × outer 0.5 = padding 6
```

The [captured nested declaration](../../../tests/fixtures/nested-binding-ownership.md) retains its
alias through import, token editing, undo, and re-encoding. Independently reopened Figma preserves
the alias and responds to token edits; an exact raster comparison covers the restored value.
Export records declarations per field rather than reauthoring unrelated inherited bindings in the
wrong owner's space.

Saved numeric consumption expressions support finite constant products with exactly one alias,
including nested `MULTIPLY` terms. References inside expressions participate in resource
normalization. Modern declarations shadow legacy fields before reference resolution.

A source instance's own saved expression already includes its local scale. The reader removes
that scale from declaration units before occurrence scaling, while retaining enclosing scales.
A saved `0.5 × alias` under another `0.5` occurrence therefore yields a multiplier of `0.25`,
not `0.125`. Override-path declarations remain in their declaring owner's units. Export writes
effective own-record coefficients and owner-relative claim coefficients instead of substituting
unscaled aliases. Unsupported operators, multiple aliases, constant-only binding expressions,
and non-finite products fail explicitly.

[Captured expression acceptance](../../../tests/fixtures/nested-binding-expression.md) covers
import, token edits/history, edited re-encoding, Figma reactivity, and exact pixels. It does not
establish a general expression engine or arbitrary expression/component-edit interactions.

[Per-field binding inheritance](../../../tests/fixtures/per-field-binding-reopen.md) preserves
an explicit placed binding while unrelated definition bindings update and remain live after
Figma reopen. Protection is normalized within each declaring owner before combining scopes;
one owner's granular declarations cannot weaken another owner's legacy whole-map protection.

Other tests cover alias updates, modes, clone isolation, unbinding undo, and portable transfer.
This does not establish complete scaled-text semantics or every component binding mutation.
New declarations use sparse, format-neutral `variableAssignmentScales` on the owning occurrence,
not the previous binding's conversion. The owner is the outermost containing instance, bounded by
a component definition. Assignment records per-field claims before notifying observers; history
restores prior values, conversions, and claims without reauthoring an inherited binding. Cloning
and portable transfer retain the assignment units.

[New root and nested assignments](../../../tests/fixtures/nested-binding-authoring.md) now pass
editor/API, local re-encoding, independent Figma reopen, and exact raster checks.

SceneGraph's explicit `componentScale` records occurrence coordinate conversion separately from
variable units. Synchronization converts source properties into target coordinates using these
recorded factors, including nested source occurrences and newly materialized children. Numeric
fields controlled by protected bindings remain protected. Only changed properties notify the
graph, so unchanged text does not lose saved glyph caches. Shared geometry rescaling lives in
SceneGraph's `scaling/` domain; the Core Figma API delegates there.

[Placed-owner rescaling](../../../tests/fixtures/nested-owner-rescale.md) exports the live
`componentScale`, owner-relative numeric claims, and refreshed descendant geometry snapshots.
Those snapshots do not author new descendant size claims. A captured half-scale operation
passes independent Figma reopen, continued token reactivity, exact pixels, and browser projection.
Local tests additionally cover enlargement to unit scale and literal padding claims.

[Native nested rescale probes](../../../tests/fixtures/nested-rescale-restrictions.md) distinguish
placed occurrence descendants from children inside a component definition. Figma's Plugin API
rejects the former, even at factor one, while permitting the latter. Core's API applies this
restriction before mutation; the generic SceneGraph scaling primitive remains policy-neutral.
[A captured definition-level rescale](../../../tests/fixtures/nested-definition-rescale.md)
now propagates through the editor scheduler, exports/reopens in Figma, retains token reactivity,
and matches exact native pixels. Existing child occurrence scales derive from the source child
and source/target parent scales, rather than retaining stale pre-edit coordinate metadata.
Undo, transitive multi-definition changes, and overridden scale interactions remain separate
acceptance requirements.

The captured component-padding edit passes undo/redo, independent Figma reopen, exact pixels,
and a browser geometry snapshot. Full lifecycle acceptance remains open: broader expressions,
typography, nested rescale/export, reparenting, and structural edits need further coverage.
No coordinate factor is inferred from current dimensions or numeric variable values.

## Implementation and tests

- [Document assembly](../src/document/materialize.ts)
- [Occurrence materializer](../src/instance-overrides/materialize-instance.ts)
- [Owner-scoped correspondence](../src/instance-overrides/source-children.ts)
- [Live component edits](../src/instance-overrides/live-component-edits.ts)
- [Component-property domain](../../scene-graph/src/components/properties.ts)
- [Text cache invalidation](../../scene-graph/src/text-picture.ts)
- [Full-document editing test](../tests/document/gold-edit.test.ts)
- [Occurrence conversion/isolation tests](../tests/document/occurrence-conversion.test.ts)
- [Saved-glyph visual test](../../../tests/e2e/canvas/saved-glyph-visual.spec.ts)

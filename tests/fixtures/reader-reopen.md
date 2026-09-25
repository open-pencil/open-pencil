# Reader exports reopened in Figma

Four exports from the occurrence-scoped reader, imported into Figma desktop and read back
through the Plugin API. `reader-reopen.json` records the observations.

**Synthetic overrides.** A `Card` component with a variable-bound icon, a label, and a nested
`Badge` instance; an instance of it carrying every override kind recorded through the Figma
API. Figma applies the root claims (name, size, padding, sizing mode) and the descendant claims
(name, opacity, text, font size, paint on a nested instance, text inside a nested instance),
and binds the overridden icon fill to `On Surface Variant` while the component keeps
`On Surface`. An instance whose component was deleted before export reopens as an instance
with no main component. Figma's own API refuses to resize that icon inside the instance, so a
`size` claim on it is not applied; that is Figma's rule, not an export gap.

Two findings came from this file and are fixed: the Figma API's `name` setter and `resize()`
did not record instance overrides, and an override inside a nested instance was addressed by
the enclosing component's copy of the child rather than the nested component's child, which
Figma's own clipboard encoding of the same edit names.

**Synthetic overrides, second round.** A `Panel` component with a stroked box, a heading, and an
auto-layout `row` holding a child that is later hidden and a nested `Dot` instance named
`marker`; an instance carrying the override kinds the first round did not cover. Figma binds the
box stroke colour to `Accent` and its corner radius to a numeric variable resolving to 8, applies
the `Heading style` text style to the heading, applies the row's padding, item spacing, and
primary sizing mode, hides the hidden child, and swaps `marker` to `Star`. It ignored the `size`
claims on `row` and `marker`, which reopened at the component's sizes; reverting a control edit
to the component's own `row` confirmed the instance was inheriting rather than overriding.

Figma does not apply those two `size` claims, and the reason is that the edit they describe does
not exist in Figma. A descendant inside an instance cannot be resized: `resize()` through the
Plugin API is a silent no-op on any instance descendant, in an imported file and in a component
the API creates itself, and the handles are unavailable in the UI. Across `gold-preview.fig`,
`material3.fig` and `nuxtui.fig` not one size claim targets a descendant that is not an
instance, and of the 100 that target a nested instance and differ from its record, 82 restate
that instance's own size claim while the rest are hug heights its text produced. A descendant
`size` claim is therefore a restatement of a nested instance's own size, never a free resize.

Three encodings were tried before that was clear, each suggested by one archive and refuted by
another, and all three are reverted: addressing path segments by `overrideKey` (`gold-preview`
is a file of library instances and addresses every segment by key, while `material3` uses a
GUID for 51,332 of its segments), `overrideLevel` on descendant claims, and
`derivedSymbolDataLayoutVersion`.

OpenPencil does allow resizing a layer inside an instance, so it can hold a document Figma
cannot represent. The writer still records those claims — the reader restores them, so the edit
survives in OpenPencil — and Figma ignores them on open, keeping the layer at its component's
size.

Three findings came from this file and are fixed: applied shared styles (`fillStyleId`,
`strokeStyleId`, `textStyleId`, `effectStyleId`, `gridStyleId`) were not recorded as instance
overrides, a nested swap lost the child's correspondence to its source so later overrides on it
were addressed by the wrong record, and the export addressed nested overrides by non-definition
records.

**gold-preview (edited).** The Input instance matches `packages/fig/tests/instance/gold-preview.test.ts`:
three Badge instances with distinct avatar swaps, the badge icon visibility, hidden leading and
trailing avatars, the trailing chevron, and placeholder typography. Figma recomputes the hug
width with its own text metrics (376.34 against 375.75 saved).

**material3 (edited).** Opens with all pages after every page was loaded and exported,
including the internal canvas that holds instances of deleted components. A List item swapped
to another variant by its List reopens as that variant; App bar leading icons resolve to the
icon each owner assigned; icon vectors keep their `On Surface Variant` alias. The Button set
keeps its 50 variants and axis properties.

Import was done by hand through Figma's Import dialog; inspection ran through `figma-use eval`
and then through `tools/visual-oracles … compare/interpreted-document.ts` against each
imported file (`--file` the exported archive, `--figma-key` the imported file). Property
differences: synthetic instance 0 of 5 nodes, synthetic Panel instance 0 of 6 nodes, material3
App bar `Configuration=Small, Elevation=Flat` 0 of 25 nodes, gold-preview Input 0 of 89 nodes.
The Panel instance has 14 geometry-only differences: four from the unapplied `size` claims, and
the positions of its auto-layout children, which the fixture saved at the instance origin
without a layout pass and Figma laid out. The gold-preview Input has
91 geometry-only differences: its hug layout was snapshotted from OpenPencil's layout
(356.34 wide) and Figma recomputed it (376.34). No pixel comparison was made.

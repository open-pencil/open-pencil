# Variables UI Roadmap

OpenPencil already has local variable data structures and a basic variables dialog. The next work should make variables usable from the inspector fields where users edit real design properties, then expand the management UI.

## Product model

Variables should feel like a design-system layer:

- Variables are grouped into collections.
- Collections contain modes.
- Variables may be grouped by slash paths, e.g. `color/text/primary`.
- Variables can be bound to node/page properties.
- Bound properties resolve through the active mode context.

Supported variable types:

- Color — fills, strokes, text color, effect colors, page background.
- Number — dimensions, layout spacing, radius, opacity, stroke width, typography sizes.
- String — text content and eventually font names.
- Boolean — visibility and eventually boolean design state.

## UI principles

- Existing inspector fields must support variable binding directly; a standalone variables table is not enough.
- Every bindable field should have the same three states:
  - Direct value with an apply-variable affordance.
  - Bound value with variable name and resolved preview.
  - Mixed value/binding for multi-selection.
- Variable pickers should be filtered by type and scope.
- Variable names should stay readable in cramped inspector rows.
- Warning/error states should be copyable when they carry diagnostic text.

## Phase 1 — Field-level binding primitives

Create reusable UI for applying variables to existing fields.

- Add a shared variable picker popover.
- Add a bound-variable pill/button pattern.
- Replace the current one-off fill/stroke color variable popover with the shared primitive.
- Keep current core path convention for color bindings: `fills/{index}/color`, `strokes/{index}/color`.
- Preserve existing fill/stroke behavior and tests.

Initial target fields:

- Fill color rows.
- Stroke color rows.

## Phase 2 — Number bindings in the inspector

Add reusable number-variable binding support and integrate the high-impact fields first:

- Width and height.
- Min/max width and height.
- Corner radius and independent radii.
- Auto-layout gap and padding.
- Stroke width.
- Opacity.
- Font size, line height, and letter spacing.

## Phase 3 — Variables management view

Improve the variables editor itself after field binding patterns are established.

- Make the variables dialog larger, closer to an edge-to-edge variables view.
- Replace collection tabs with a collection sidebar.
- Add a variable type picker for `+ Variable`.
- Render slash-path groups as grouped rows.
- Improve type-specific value cells.
- Add clearer empty states.

## Phase 4 — Mode management

Make modes editable as first-class collection columns.

- Add mode.
- Rename mode.
- Duplicate mode.
- Delete mode.
- Reorder mode.
- Treat the left-most mode as the default mode, matching Figma’s model.
- Add undo/redo for mode operations.

## Phase 5 — Mode context

Allow pages/frames/layers to choose variable modes.

Resolution order should be:

1. Explicit mode on the node for the collection.
2. Parent-chain explicit mode.
3. Page explicit mode.
4. Collection default mode.

Inspector UI:

- Page variables section: collection → selected mode.
- Selected frame/layer Appearance section: collection → Auto/Default/specific mode.

## Phase 6 — Aliases and token workflows

- Add alias editing in value cells.
- Filter alias picker by same variable type.
- Show resolved value previews.
- Prevent alias cycles.
- Add DTCG token import/export later.

## Non-goals for the first implementation

- Remote libraries.
- Publishing workflows.
- Extended collections.
- Prototype variable actions.
- Expressions.
- Team/workspace default modes.

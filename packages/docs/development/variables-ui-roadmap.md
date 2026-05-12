# Variables UI Roadmap

OpenPencil already supports local variable collections, modes, aliases, import/export, a variables dialog, color bindings, and several number bindings in the inspector. The remaining work should focus on making variables feel complete in day-to-day editing instead of expanding scope into remote libraries.

## Current status

Implemented:

- Local variable collections and modes.
- Color, number, string, and boolean variable values.
- Alias values and alias resolution.
- Variables dialog with collection tabs, mode columns, type picker, add/rename/delete flows, and mode duplicate/default/delete actions.
- Shared variable picker popover.
- Fill and stroke color bindings using `fills/{index}/color` and `strokes/{index}/color`.
- Number binding primitives via `VariableScrubInput` / `useNumberVariableBinding`.
- Number bindings for opacity, corner radius, independent radii, and size controls.
- .fig/.pen variable import/export paths and token/codegen helpers.

## Principles

- Inspector fields should bind variables directly; the variables table alone is not enough.
- Every bindable field should support direct, bound, and mixed states.
- Pickers should be filtered by variable type.
- Bound values should show the variable name plus the resolved preview/value.
- Variable mode behavior should match Figma where practical: the left-most mode is the default mode.

## Next useful work

### 1. Finish high-impact number bindings

Add bindings for remaining common numeric inspector fields:

- Auto-layout gap.
- Padding values.
- Stroke width.
- Font size.
- Line height.
- Letter spacing.
- Min/max width and height.

### 2. Improve variable management UI

The current dialog works, but it still feels like an early table UI. Next improvements:

- Move collections from top tabs to a left sidebar.
- Render slash-path groups, e.g. `color/text/primary`, as grouped rows.
- Improve type-specific value cells.
- Add clearer empty states for collection, search, and mode columns.
- Add copyable diagnostics for invalid aliases or unresolved bindings.

### 3. Complete mode operations

Mode operations exist, but should be made robust and undoable:

- Add mode reorder.
- Add undo/redo coverage for add, rename, duplicate, default, delete, and reorder.
- Ensure the first mode is always treated as the default mode in import/export and UI.

### 4. Add mode context

Allow pages, frames, and selected layers to choose modes per collection.

Resolution order:

1. Explicit mode on the node for the collection.
2. Parent-chain explicit mode.
3. Page explicit mode.
4. Collection default mode.

Inspector UI:

- Page variables section: collection → selected mode.
- Selected frame/layer Appearance section: collection → Auto/Default/specific mode.

### 5. Improve aliases and token workflows

- Add alias editing in value cells.
- Filter alias picker by same variable type.
- Show resolved value previews.
- Prevent alias cycles in editing flows, not only resolution.
- Add DTCG token import/export after local workflows feel solid.

## Non-goals for this roadmap

- Remote variable libraries.
- Publishing workflows.
- Team/workspace default modes.
- Prototype variable actions.
- Expressions.

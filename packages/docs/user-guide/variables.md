---
title: Variables
description: Design variables, collections, modes, and fill bindings in OpenPencil.
---

# Variables

Variables store reusable design tokens — colors, spacing values, and other properties — that can be bound to nodes. Change a variable's value and every node using it updates.

## Opening the Variables Dialog

Open it from **View → Variables…**, by searching "Variables" in the command palette, or, with no nodes selected, from the Variables section of the Design tab. **Expand** in the dialog's corner gives it most of the window.

The dialog lists the active collection's variables on the left, edits the selected variable or the collection on the right, and shows the stylesheet they produce below. In a narrow window or on a phone it shows one mode at a time, and a variable, the collection settings, or the stylesheet opens over the list with a back button.

## Collections

Variables are organized into collections. In a wide dialog they are listed in a sidebar with how many variables each holds; narrower, they are tabs, or a menu on a phone.

- **Switch collection** — click it in the sidebar or its tab
- **Create collection** — click **+** next to Collections, or the folder button in the toolbar
- **Rename or delete** — with no variable selected, the right side edits the collection: change its name, or delete it from the **⋯** menu next to the name
- **Switch attribute** — the attribute that turns manually switched modes on, `data-theme` by default for a collection named Theme; type another name, such as `data-color-scheme`, to match an existing codebase

## Modes

Each collection can have multiple modes (e.g., Light and Dark). Modes appear as value columns in the list, and a variable has a value for each mode. Manage them in the collection settings:

- **Add mode** — click **+** next to Modes
- **Rename** — edit the mode's name
- **Duplicate, set as default, delete** — use the **⋯** menu next to the mode

The default mode is **Always on** and goes in `:root`. Every other mode has **Applies when**, which says when the mode takes over in the exported stylesheet; the CSS it writes is shown underneath:

| Applies when | CSS |
| --- | --- |
| **Switched manually** | the collection's switch attribute set to the mode, such as `[data-theme="dark"]` for a Theme collection's Dark mode |
| **System is in dark mode** / **System is in light mode** | `@media (prefers-color-scheme: dark)` / `light` |
| **High contrast is on** | `@media (prefers-contrast: more)` |
| **Reduced motion is on** | `@media (prefers-reduced-motion: reduce)` |
| **Screen is narrower than** / **Screen is wider than** a width | `@media (max-width: 640px)` / `min-width` |
| **Container is narrower than** / **Container is wider than** a width | `@container (max-width: 640px)` / `min-width` |
| **Custom CSS** | any selector, or a `@media`, `@supports`, or `@container` query |

On the canvas, a layer shows a mode when you set the layer to it, whatever the condition. In exported code, a manually switched mode is turned on by adding its attribute to an element, so layers set to it export with that attribute. Layers set to a mode with any other condition, custom selectors included, export with literal values instead of tokens, because the stylesheet, not the layer, decides when that mode applies.

## Managing Variables

Variables are grouped by the folders in their names (`Brand/Primary` appears as *Primary* under *Brand*), with their CSS name and one value per mode.

- **Create variable** — click **Create variable** (or **+**) and pick a type; the new variable opens for editing
- **Select** — click a row, or move with the arrow keys and press Enter. Shift-click selects a range, and Cmd-click (Ctrl-click on Windows and Linux) adds or removes one
- **Filter** — type in the search bar to filter by name, CSS name, description, or value, such as `--color-brand`, a hex color, or the variable an alias points at, forgiving typos as the command palette does; click a group in the sidebar to show only that group and the groups inside it, or use the filter button to show only some types
- **Rename or edit in place** — double-click a name, or a number or text value, in the list
- **Right-click** — rename, duplicate, move to a group (or a new one), or delete the selected variables; Delete or Backspace deletes them too
- **Reorder** — drag a row; the order is kept in the file
- **Several selected** — the right side moves them into a group, duplicates them, or deletes them
- **Undo and redo** — Cmd+Z and Cmd+Shift+Z or Cmd+Y (Ctrl on Windows and Linux) work in the dialog as on the canvas, one step per change. Enter commits a field and returns to the list; while a field has text you have not committed, Cmd+Z undoes the typing

Selecting a variable edits:

- **Name** and **CSS name** — leave the CSS name empty to derive it from the name and scopes, such as `--color-brand-primary`. Type the name without its `--`; a name CSS cannot use is flagged and not saved
- **Unit** — for numbers, `px`, `rem`, `%`, `ms`, `s`, `deg`, or none; values are entered in that unit
- **Value** (or **Values**, one per mode) — a color opens the color picker. The variable button next to a value points it at another variable of the same type, an alias that follows that variable; **Detach variable** turns it back into the value it showed
- **CSS expression** — for numbers, a value such as `clamp(1rem, 4vw, 1.5rem)` written instead of the number in CSS, while the canvas keeps drawing the number
- **Scopes** — which properties the variable is offered for
- **Description**
- **Hide from publishing** — files that use this one as a library do not see the variable

## Stylesheet

The bottom of the dialog shows the active collection as CSS custom properties. The copy button copies the whole document's variables as CSS or as a Tailwind v4 theme, so aliases to other collections resolve.

## Binding Variables to Fills

In the Fill section of the properties panel, use the variable picker to bind a color variable to a node's fill.

- **Bind** — select a color variable from the picker. The fill shows a purple badge with the variable name.
- **Detach** — click the detach button on the badge to remove the binding. The fill reverts to the resolved color value.

When the variable's value changes (or when switching modes), all bound fills update automatically.

## Tips

- Use collections to group related tokens (e.g., "Primitives" for raw colors, "Semantic" for role-based aliases, "Spacing" for layout values).
- Modes are useful for theme switching — define Light and Dark mode values in the same collection.
- Variables support aliases — a "Semantic" collection can reference values from a "Primitives" collection.
- See [Drawing Shapes](./drawing-shapes) for how fills and the color picker work.

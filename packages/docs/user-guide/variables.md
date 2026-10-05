---
title: Variables
description: Design variables, collections, modes, and fill bindings in OpenPencil.
---

# Variables

Variables store reusable design tokens — colors, spacing values, and other properties — that can be bound to nodes. Change a variable's value and every node using it updates.

## Opening the Variables Dialog

With no nodes selected, the Design tab shows page-level properties including a Variables section with collection and variable counts. Click the settings icon to open the variables dialog.

The dialog lists the active collection's variables on the left, edits the selected variable or the collection on the right, and shows the stylesheet they produce below. In a narrow window or on a phone it shows one mode at a time, and a variable, the collection settings, or the stylesheet opens over the list with a back button.

## Collections

Variables are organized into collections, shown as tabs (a menu on narrow screens).

- **Switch collection** — click a tab
- **Create collection** — click the folder button in the toolbar
- **Rename or delete** — with no variable selected, the right side edits the collection: change its name or delete it

## Modes

Each collection can have multiple modes (e.g., Light and Dark). Modes appear as value columns in the list, and a variable has a value for each mode. Manage them in the collection settings:

- **Add mode** — click **+** next to Modes
- **Rename** — edit the mode's name
- **Duplicate, set as default, delete** — use the **⋯** menu next to the mode
- **Condition** — the CSS selector or `@media`, `@supports`, or `@container` query that turns the mode on in the stylesheet. Left empty, it is an attribute named after the collection and mode, such as `[data-theme="dark"]` for a Theme collection's Dark mode. The default mode always goes in `:root`.

## Managing Variables

Variables are grouped by the folders in their names (`Brand/Primary` appears as *Primary* under *Brand*), with their CSS name and one value per mode.

- **Create variable** — click **+** in the toolbar and pick a type; the new variable opens for editing
- **Select** — click a row, or move with the arrow keys and press Enter
- **Search** — type in the search bar to filter variables by name
- **Delete** — click **Delete variable** at the bottom of its settings

Selecting a variable edits:

- **Name** and **CSS name** — leave the CSS name empty to derive it from the name and scopes, such as `--color-brand-primary`
- **Unit** — for numbers, `px`, `rem`, `%`, `ms`, `s`, `deg`, or none; values are entered in that unit
- **Values** — per mode; a color opens the color picker, and an alias shows the variable it points to
- **CSS expression** — for numbers, a value such as `clamp(1rem, 4vw, 1.5rem)` written instead of the number in CSS, while the canvas keeps drawing the number
- **Scopes** — which properties the variable is offered for
- **Description**

## Stylesheet

The bottom of the dialog shows the active collection as CSS custom properties or a Tailwind v4 theme. The copy button copies the whole document's variables in that format, so aliases to other collections resolve.

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

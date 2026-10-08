---
title: Icons
description: Search open-source icon sets, insert icons, and swap or recolor them in OpenPencil.
---

# Icons

OpenPencil searches the open-source icon sets published through [Iconify](https://iconify.design), such as Lucide, Material Symbols, Tabler, and Phosphor. A placed icon remembers which icon it is, so you can swap it for another or change its color later, and exports write it as that icon.

Searching and placing icons needs a network connection to the Iconify API.

## Inserting an Icon

Open the icon picker in any of these ways:

- Click the **Insert icon** button at the end of the toolbar
- Choose **Object → Insert Icon…**
- Search for **Insert Icon** in the command palette (<kbd>⌘</kbd><kbd>K</kbd>)

Type what you're looking for, such as `arrow` or `heart`. Each result shows a preview and the set it comes from. Pick one to place it, 24 × 24, in the middle of the view, inside the frame you're editing if you've entered one. The new icon is selected, and <kbd>⌘</kbd><kbd>Z</kbd> removes it in one step.

## The Icon Section

Selecting a placed icon adds an **Icon** section to the Design panel.

- **Swap icon** opens the picker and draws the chosen icon in place of the current one. The icon keeps its size, position, and color.
- **Icon color** changes the color of the icon's own paths. Icons drawn in several fixed colors, such as brand logos, keep those colors and don't show this field.

Each swap or color change is one undo step; dragging in the color picker undoes as a single change.

An icon is a frame of vector paths, so its layers, constraints, effects, and the rest of the Design panel work as they do for any frame. Swapping replaces the paths, including any you edited by hand.

## Icons in Exports

- **Design JSX** writes a placed icon as `<Icon name="lucide:heart" size={24} color="#…" />`.
- **HTML** writes it as inline SVG marked with `data-icon`, with its paths painted in `currentColor` and the icon's color set on the `<svg>`, so changing that one `color` recolors it.
- **SVG and images** draw it like any other vector.

Icons placed by AI agents, MCP clients, and design JSX are icons in the same way, so the Icon section works on them too.

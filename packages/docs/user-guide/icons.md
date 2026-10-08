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

Before you type, the picker shows the icons already placed in this file and the ones you picked lately. Type what you're looking for, such as `arrow` or `heart`, to search every set; each result shows a preview and the set it comes from.

Pick one to place it, 24 × 24, in the middle of the view, inside the frame you're editing if you've entered one. The new icon is selected, and <kbd>⌘</kbd><kbd>Z</kbd> removes it in one step.

## Choosing an Icon Set

The set button at the end of the search field (**All icon sets** at first) narrows the picker to one set. Sets are grouped by kind, such as Material or Logos; type to find one by name, such as `tabler`. Each set shows how many icons it has.

With a set chosen, the picker shows the whole set, loading more as you scroll, and a search looks only in that set. Hover over an icon, or move to it with the arrow keys, to see its name, set, and license below the grid. The picker remembers the set you chose last, and **Swap icon** opens on the set of the icon you're swapping.

## The Icon Section

Selecting a placed icon adds an **Icon** section to the Design panel.

- **Swap icon** opens the picker and draws the chosen icon in place of the current one. The icon keeps its size, position, and color.
- **Icon color** changes the color of the icon's own paths. Icons drawn in several fixed colors, such as brand logos, keep those colors and don't show this field.

Each swap or color change is one undo step; dragging in the color picker undoes as a single change.

An icon is a frame of vector paths, named after the icon, such as `cat`, and marked with a smiley in the layer tree. Unlike other frames on the page, it has no title on the canvas, and resizing it scales its paths. Its layers, constraints, effects, and the rest of the Design panel work as they do for any frame.

## Editing an Icon's Paths

You can edit an icon's paths like any vector. Once its points, paths, or own colors change, the Icon section says **Modified**:

- The icon exports as the paths it now draws rather than by its name, so the edit is kept.
- **Reset** (the circular arrow) draws the original icon again, at the same size and color.
- Swapping asks first, since a swap draws a new icon and discards the edit.

Resizing the icon or changing its color doesn't count as an edit.

**Detach icon**, in the Icon section, the canvas menu, or **Object → Detach Icon**, makes an icon plain artwork: it keeps its paths but is no longer swapped, recolored, or exported as an icon. Like every icon command, it's one undo step.

## Icons in Exports

- **Design JSX** writes a placed icon as `<Icon name="lucide:heart" size={24} color="#…" />`.
- **HTML** writes it as inline SVG marked with `data-icon`, with its paths painted in `currentColor` and the icon's color set on the `<svg>`, so changing that one `color` recolors it.
- **SVG and images** draw it like any other vector.

Icons placed by AI agents, MCP clients, and design JSX are icons in the same way, so the Icon section works on them too.

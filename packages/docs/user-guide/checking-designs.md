---
title: Checking Designs
description: Find accessibility, consistency, and structure issues with the Lint panel and canvas issue markers.
---

# Checking Designs

OpenPencil checks the current page as you work and points out layers that break common design rules: text that is hard to read, controls that are too small to tap, colors that should use a variable, and spacing off the scale.

## Lint Panel

Open the **Lint** tab in the right panel. Its badge shows how many errors and warnings the page has.

- **Page** lists every issue on the current page; **Selection** narrows the list to the selected layers and everything inside them; **Document** lists every page's issues, tagging the ones on other pages. Clicking one of those switches to its page. Pages of a large `.fig` file that have not been opened yet are checked once you open them.
- Issues are grouped by rule, most severe first. Errors and warnings start expanded; suggestions start collapsed.
- The severity buttons under the scope switch filter errors, warnings, and suggestions on and off.
- Hover a group title to read what the rule checks and why.

Hover an issue to highlight its layer on the canvas. Click it to select the layer; if it is off screen, the canvas pans to it, and zooms out only when the layer does not fit.

## Fixing Issues

Rows that can be fixed in one step show a button on hover:

- A hardcoded color that matches one of the document's color variables binds to it (link button). The row names the variable.
- Subpixel positions and sizes round to whole pixels. Values that auto layout or text resizing sets, and vector artwork and the parts of groups, are left alone.
- Off-scale corner radius and spacing change to the nearest scale value, and text below the minimum size grows to it (wand button). These change the design, so they apply one row at a time.

Binding colors and rounding pixels keep the design as it looks, so their groups also offer **Bind all** or **Fix all**. Every fix is a single undo step.

Other issues show the value that needs attention, such as a contrast ratio or a touch target size, so you can fix them in the Design panel.

## Canvas Markers

Layers with errors and warnings carry a marker at their top-right corner: red for errors, amber for warnings. Suggestions appear only in the Lint panel.

- Hover a marker to see its issues. Click it to select the layer and open its issues in the Lint panel.
- Markers that would overlap merge into one showing their combined count.
- When a layer is too small to see at the current zoom, its marker moves to the nearest enclosing layer large enough to point at.
- Errors and warnings outside the visible canvas are pinned to its edge, pointing toward them. Hover a pin to see them; click it to bring the nearest of the most severe into view and open it in Lint.
- Hidden layers and layers clipped out of view by a frame keep their issues in the panel but get no marker.

Pages with errors or warnings show their count in the page list, checked in the background while you work. The Layers panel marks the same layers: a layer with errors or warnings shows the most severe as an icon, and a collapsed layer with issues inside it shows a dot.

Turn markers and Layers panel marks on or off with **View → Design issues**, or with **Show issues on canvas** in the Lint panel's settings menu.

## In the Code Panel

The Code tab underlines errors and warnings on the Design JSX or Tailwind JSX of their layers, on the property that causes the issue when there is one, such as `size={10}` for small text. Hover the underline to read the issue. The underlines follow your edits while you change the code live.

## Rules

The settings menu in the Lint panel switches between rule presets:

- **Recommended** — balanced defaults for everyday work.
- **Strict** — every rule as a warning or error.
- **Accessibility** — contrast, touch target size, and text size only.

Turn off a single rule from its group's menu. **Turn on turned-off rules** in the settings menu brings them back. Presets and turned-off rules are saved between sessions.

The same rules run from the command line with `openpencil lint`; see [Inspecting Files](/programmable/cli/inspecting).

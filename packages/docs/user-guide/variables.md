---
pageClass: guide
title: Variables
description: Keep colors, sizes, and other values in one place, switch them with modes, and take them to code as CSS or design tokens.
---

# Variables

A variable is a named value, such as a brand color or a corner radius, that layers use instead of a number of their own. Change the variable, and every layer that uses it changes. Modes give the same variables other values, such as a dark theme.

## Open Variables

Choose **View → Variables…**, or click an empty part of the canvas and open **Variables** in the Design panel.

<GuideImage name="variables/dialog" alt="The Variables window with the Theme collection, four variables in Light and Dark, the collection settings, and the stylesheet" />

1. **Collections** group variables, such as colors or spacing.
2. Each **variable** has a value in each mode, in columns.
3. **Settings** for the selected variable, or for the collection when none is selected.
4. The **stylesheet** shows the collection as CSS.

**Expand** in the window's corner gives it most of the screen. In a narrow window or on a phone, it shows one mode at a time.

## Create a Variable

1. Click **Create variable** and choose a type: color, number, text, true/false, easing, or timing.
2. Type a name. Slashes put it in a group: `Brand/Primary` appears as **Primary** under **Brand**.
3. Set its value in each mode.

On the right, you can also set:

- **CSS name**, which the stylesheet uses. Left empty, it comes from the name, such as `--color-brand-primary`.
- **Unit** for numbers: `px`, `rem`, `%`, `ms`, `s`, `deg`, or none.
- **Scopes**, the settings that offer the variable.
- **Description**, and **Hide from publishing** to keep it out of [libraries](./component-libraries).

To make a variable follow another one, click the variable button next to its value and pick it. **Detach variable** turns it back into a plain value.

## Use a Variable

<GuideLegend>

<GuideImage name="variables/apply" alt="The Fill row of a selected layer with its Apply variable button open, listing the Theme colors" />

1. Select a layer.
2. Click **Apply variable** next to a setting, such as a fill color, a corner radius, or a gap.
3. Pick a variable.

</GuideLegend>

The setting then shows the variable's name. To use a plain value again, click **Apply variable** and choose **Detach variable**.

## Use Modes

A collection can have several modes, such as **Light** and **Dark**. Every variable in it has a value in each one.

- To add a mode, click **+** beside **Modes** in the collection's settings.
- To rename one, edit its name. The **⋯** menu next to it duplicates it, makes it the default, or deletes it.

<GuideLegend>

<GuideImage name="variables/mode" alt="The Theme setting in Appearance open, with Auto, Light, and Dark" />

To show a frame in another mode, select it and choose the mode in **Appearance**. Layers inside it follow, unless they have a mode of their own. **Auto** takes the mode from the layer around it.

</GuideLegend>

In code, **Applies when** says when a mode takes over. The CSS it writes shows underneath:

| Applies when | CSS |
| --- | --- |
| **Switched manually** | an attribute on an element, such as `[data-theme="dark"]` |
| **System is in dark mode** | `@media (prefers-color-scheme: dark)` |
| **System is in light mode** | `@media (prefers-color-scheme: light)` |
| **High contrast is on** | `@media (prefers-contrast: more)` |
| **Reduced motion is on** | `@media (prefers-reduced-motion: reduce)` |
| **Screen is narrower than** a width | `@media (max-width: 640px)` |
| **Screen is wider than** a width | `@media (min-width: 640px)` |
| **Container is narrower than** a width | `@container (max-width: 640px)` |
| **Container is wider than** a width | `@container (min-width: 640px)` |
| **Custom CSS** | any selector, or a `@media`, `@supports`, or `@container` query |

The default mode is always on and goes in `:root`. A collection's **Switch attribute**, `data-theme` by default, is the attribute that turns its manual modes on. Change it to match your code, such as `data-color-scheme`.

Layers set to a manual mode export with its attribute. Layers set to a mode with any other condition export with plain values, since the stylesheet decides when that mode applies.

## Organize Variables

- **Collections:** click **+** beside **Collections** to add one. With no variable selected, the right side renames the collection, and its **⋯** menu deletes it.
- **Find:** type in the search field to filter by name, CSS name, description, or value. Click a group to show just that group, or use the filter button for some types only.
- **Select:** click a row, or use the arrow keys. <Keys mac="⇧" other="Shift" />-click selects a range, and <Keys mac="⌘" other="Ctrl" />-click adds one.
- **Edit in place:** double-click a name, number, or text in the list.
- **Move and delete:** right-click to rename, duplicate, move to a group, or delete. Drag rows to reorder them.
- **Undo:** <Keys mac="⌘ Z" other="Ctrl Z" /> works here as it does on the canvas.

## Write a Formula

A number's value can be a formula over other variables, such as `space/base * 4`. Start typing a variable's name and pick it, or choose **Use a variable**. The field shows the result, such as `= 16px`. For other types, choose **Use a formula** beside the value.

- Numbers use `+`, `-`, `*`, `/` and parentheses.
- True/false values use `and`, `or`, and `not`, and compare with `==`, `!=`, `<`, `<=`, `>`, and `>=`: `viewport > 1024 and not loading`.
- Text goes in double quotes, and `+` joins it: `"Hello, " + name`. `text(count)` writes a number as Figma does.
- `if(condition, then, otherwise)` picks between two values: `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` is false for `0`, empty text, `false`, `no`, and `off`.

Mistakes, such as an unknown name or a loop, show when you leave the field, and the old value stays. Renaming a variable keeps the formulas that use it working.

In the stylesheet, a number formula becomes `calc()`. Formulas with `if()`, text, or true/false values can't be written as CSS and are left out.

A number can also have a **CSS expression** that replaces it in code only, such as `clamp(1rem, 4vw, var(--spacing-md))`. Add it from the value's **⋯** menu.

## Easing and Timing Variables

Easing and timing variables hold motion: how long a change takes and how it speeds up and slows down. [Component transitions](./components#make-a-component-work-like-a-control) can follow them, so a **Reduced motion** mode can shorten every transition at once.

- **Timing** is a duration, typed in milliseconds, such as `250ms`, or seconds, such as `0.25s`.
- **Easing** is a curve or a spring. Click it to open the editor:
  - **Curve:** pick an ease or **Custom bezier**, then drag the two handles or type the numbers. **Flip curve** plays it backwards.
  - **Spring:** pick Gentle, Quick, Bouncy, Slow, or **Custom spring**. Drag the first overshoot under **Time**, or set stiffness, damping, and mass under **Physics**.

In CSS, a timing is written in milliseconds and a curve as a timing function, such as `cubic-bezier(0.45, 1.45, 0.8, 1)`. Springs have no CSS form there and are left out.

## Copy Variables as Code

The copy button above the stylesheet copies every collection as CSS, or as a Tailwind v4 theme.

## Import and Export Design Tokens

Variables and styles move between OpenPencil, Figma, and code as [design tokens](https://www.designtokens.org/).

- **Export:** in the stylesheet's copy menu, choose **Export as design tokens**. You get a zip with a file for each mode, which Figma imports as a mode, and the text and effect styles.
- **Import:** click **Import design tokens** at the top of the window and choose token files or a zip. Files from Figma and Tokens Studio work.

Before importing, the window shows where each collection and mode goes: a new one, an existing one, or nowhere. Variables with the same name are updated, the rest are added, and nothing is deleted. **Undo** takes the whole import back.

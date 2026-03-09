---
title: JSX Renderer
description: Create designs with JSX — the syntax LLMs already know from millions of React components.
---

# JSX Renderer

OpenPencil uses JSX as its design creation language. LLMs have seen millions of React components — describing a layout as `<Frame><Text>` is natural, no special training needed. Every token matters when an AI agent performs dozens of operations, and JSX is the most compact declarative representation.

JSX is also diffable. When an AI modifies a design, the change is a JSX diff — readable, reviewable, version-controllable.

## Creating Designs

The `render` tool (available in AI chat, MCP, and CLI eval) accepts JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

In the MCP server and AI chat, the `render` tool accepts JSX strings directly. In the CLI, use the `export` command to go the other direction — [exporting designs as JSX](./cli/exporting).

## Elements

All node types are available as JSX elements:

| Element | Creates | Aliases |
|---------|---------|---------|
| `<Frame>` | Frame (container, supports auto-layout) | `<View>` |
| `<Rectangle>` | Rectangle | `<Rect>` |
| `<Ellipse>` | Ellipse / circle | |
| `<Text>` | Text node (children become text content) | |
| `<Line>` | Line | |
| `<Star>` | Star | |
| `<Polygon>` | Polygon | |
| `<Vector>` | Vector path | |
| `<Group>` | Group | |
| `<Section>` | Section | |

## Style Props

Compact shorthand props inspired by Tailwind's naming.

### Layout

| Prop | Description |
|------|-------------|
| `flex` | `"row"` or `"col"` — enables auto-layout |
| `gap` | Space between children |
| `wrap` | Wrap children to next line |
| `rowGap` | Counter-axis spacing when wrapping |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Padding |

### Size & Position

| Prop | Description |
|------|-------------|
| `w`, `h` | Width/height — number, `"fill"`, or `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Size constraints |
| `x`, `y` | Position |

### Appearance

| Prop | Description |
|------|-------------|
| `bg` | Background fill (hex color) |
| `fill` | Alias for `bg` |
| `stroke` | Stroke color |
| `strokeWidth` | Stroke width (default: 1) |
| `rounded` | Corner radius (or `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | iOS-style smooth corners (0–1) |
| `opacity` | 0–1 |
| `shadow` | Drop shadow (e.g. `"0 4 8 #00000040"`) |
| `blur` | Layer blur radius |
| `rotate` | Rotation in degrees |
| `blendMode` | Blend mode |
| `overflow` | `"hidden"` or `"visible"` |

### Typography

| Prop | Description |
|------|-------------|
| `size` / `fontSize` | Font size |
| `font` / `fontFamily` | Font family |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"`, or number |
| `color` | Text color |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Exporting to JSX

Convert existing designs back to JSX:

```sh
open-pencil export design.fig -f jsx                   # OpenPencil format
open-pencil export design.fig -f jsx --style tailwind  # Tailwind classes
```

The round-trip works: export a design as JSX, modify the code, render it back.

## Visual Diffing

Because designs are representable as JSX, changes become code diffs:

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

This makes design changes reviewable in pull requests, trackable in version control, and auditable in CI.

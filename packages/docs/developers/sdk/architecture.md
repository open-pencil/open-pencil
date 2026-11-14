---
title: SDK Architecture
description: Folder structure, public API boundaries, and composition patterns in @open-pencil/vue.
---

# SDK Architecture

`@open-pencil/vue` is the Vue-facing layer over `@open-pencil/core`.

It does not own the editor model itself. It adapts the core editor into:

- Vue injection
- reactive composables
- headless structural primitives
- canvas and input wiring

## Folder structure

This package is organized by domain.

### Component families

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `PropertySection/`
- `SegmentedControl/`
- `NumberField/`
- `Toolbar/`

These contain structural/headless primitives and local helpers.

### Controls

`controls/` contains property-panel and editor control composables:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useColorModel`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`
- `useEditorPropertyList`

### Variables

`VariablesEditor/` contains variables-domain composables and state wiring.

### Selection

`selection/` contains selection-derived editor state and capabilities.

### Context

`context/` contains editor injection helpers:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Internal

`internal/` contains cross-cutting utilities not intended as primary headless primitives.

## Public API philosophy

### Prefer composables

If the problem is mostly control logic, state derivation, or editor actions, expose a composable.

### Keep headless primitives for meaningful structure

Use component roots when they coordinate structure, children, slots, or context.

Examples:

- `PageListRoot`
- `PropertyListRoot`
- `PropertySectionRoot`
- `SegmentedControlRoot`
- `ToolbarRoot`

### Avoid broad context-dump slots

Prefer focused slot props or direct composable usage over giant `v-slot="ctx"` payloads. Controlled primitives such as `PropertyListRoot` emit semantic events; editor selection and undo wiring belongs in an adapter or control composable, not the primitive.

## App vs SDK responsibility

### SDK owns

- editor integration
- reusable headless logic
- reusable UI structure without styling assumptions
- canvas rendering integration

### App owns

- styling
- layout shells
- routing
- product file flows
- toasts, menus, and app-specific UX

## Practical rule of thumb

If a piece of logic could be reused in a different OpenPencil-based app without bringing app styling with it, it probably belongs in `@open-pencil/vue`.

## Related pages

- [SDK Getting Started](./getting-started)
- [API Reference](./api/)

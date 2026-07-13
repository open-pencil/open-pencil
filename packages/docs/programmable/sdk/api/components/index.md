---
title: Components
description: Component reference for headless Vue primitives in @open-pencil/vue.
---

# Components

`@open-pencil/vue` exposes headless structural primitives for canvas wiring, navigation UI, property panels, and focused input controls.

## Core editor primitives

<SdkCardGroup>
  <SdkCard title="CanvasRoot" to="/programmable/sdk/api/components/canvas-root" description="Headless canvas structure and context." />
  <SdkCard title="CanvasSurface" to="/programmable/sdk/api/components/canvas-surface" description="Canvas element primitive bound to CanvasRoot context." />
  <SdkCard title="LayerTreeRoot" to="/programmable/sdk/api/components/layer-tree-root" description="Headless layer tree primitive." />
  <SdkCard title="LayerTreeItem" to="/programmable/sdk/api/components/layer-tree-item" description="Single layer-tree row primitive." />
  <SdkCard title="ToolbarRoot" to="/programmable/sdk/api/components/toolbar-root" description="Headless toolbar primitive." />
  <SdkCard title="ToolbarItem" to="/programmable/sdk/api/components/toolbar-item" description="Single toolbar tool primitive." />
  <SdkCard title="PageListRoot" to="/programmable/sdk/api/components/page-list-root" description="Headless page list primitive." />
</SdkCardGroup>

## Property panel primitives

<SdkCardGroup>
  <SdkCard title="PropertyListRoot" to="/programmable/sdk/api/components/property-list-root" description="Headless property list primitive." />
  <SdkCard title="PropertyListItem" to="/programmable/sdk/api/components/property-list-item" description="Single fills, strokes, or effects row primitive." />
  <SdkCard title="PositionControlsRoot" to="/programmable/sdk/api/components/position-controls-root" description="Position, size, and transform controls." />
  <SdkCard title="LayoutControlsRoot" to="/programmable/sdk/api/components/layout-controls-root" description="Auto-layout and sizing controls." />
  <SdkCard title="AppearanceControlsRoot" to="/programmable/sdk/api/components/appearance-controls-root" description="Opacity, visibility, and corner-radius controls." />
  <SdkCard title="TypographyControlsRoot" to="/programmable/sdk/api/components/typography-controls-root" description="Font, alignment, and formatting controls." />
</SdkCardGroup>

## Pickers and inputs

<SdkCardGroup>
  <SdkCard title="ColorPickerRoot" to="/programmable/sdk/api/components/color-picker-root" description="Popover-based color picker primitive." />
  <SdkCard title="ColorInputRoot" to="/programmable/sdk/api/components/color-input-root" description="Headless color input helper." />
  <SdkCard title="FillPickerRoot" to="/programmable/sdk/api/components/fill-picker-root" description="Popover-based fill picker primitive." />
  <SdkCard title="FontPickerRoot" to="/programmable/sdk/api/components/font-picker-root" description="Searchable font picker primitive." />
  <SdkCard title="GradientEditorRoot" to="/programmable/sdk/api/components/gradient-editor-root" description="Root primitive for gradient editing." />
  <SdkCard title="GradientEditorBar" to="/programmable/sdk/api/components/gradient-editor-bar" description="Draggable gradient bar primitive." />
  <SdkCard title="GradientEditorStop" to="/programmable/sdk/api/components/gradient-editor-stop" description="Single gradient stop primitive." />
  <SdkCard title="NumberField" to="/programmable/sdk/api/components/number-field" description="Numeric field anatomy with scrubbing, expressions, and keyboard stepping." />
</SdkCardGroup>

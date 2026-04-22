---
title: Componentes
description: Referencia de componentes para los primitivos headless de Vue en @open-pencil/vue.
---

# Componentes

`@open-pencil/vue` expone primitivos estructurales headless para el cableado del canvas, la UI de navegación, los paneles de propiedades y los controles de entrada enfocados.

## Primitivos principales del editor

<SdkCardGroup>
  <SdkCard title="CanvasRoot" to="/programmable/sdk/api/components/canvas-root" description="Estructura y contexto headless del canvas." />
  <SdkCard title="CanvasSurface" to="/programmable/sdk/api/components/canvas-surface" description="Primitivo de elemento canvas vinculado al contexto de CanvasRoot." />
  <SdkCard title="LayerTreeRoot" to="/programmable/sdk/api/components/layer-tree-root" description="Primitivo headless del árbol de capas." />
  <SdkCard title="LayerTreeItem" to="/programmable/sdk/api/components/layer-tree-item" description="Primitivo de fila individual del árbol de capas." />
  <SdkCard title="ToolbarRoot" to="/programmable/sdk/api/components/toolbar-root" description="Primitivo headless de la barra de herramientas." />
  <SdkCard title="ToolbarItem" to="/programmable/sdk/api/components/toolbar-item" description="Primitivo de herramienta individual de la barra de herramientas." />
  <SdkCard title="PageListRoot" to="/programmable/sdk/api/components/page-list-root" description="Primitivo headless de la lista de páginas." />
</SdkCardGroup>

## Primitivos del panel de propiedades

<SdkCardGroup>
  <SdkCard title="PropertyListRoot" to="/programmable/sdk/api/components/property-list-root" description="Primitivo headless de lista de propiedades." />
  <SdkCard title="PropertyListItem" to="/programmable/sdk/api/components/property-list-item" description="Primitivo de fila individual de rellenos, trazos o efectos." />
  <SdkCard title="PositionControlsRoot" to="/programmable/sdk/api/components/position-controls-root" description="Controles de posición, tamaño y transformación." />
  <SdkCard title="LayoutControlsRoot" to="/programmable/sdk/api/components/layout-controls-root" description="Controles de auto-layout y tamaño." />
  <SdkCard title="AppearanceControlsRoot" to="/programmable/sdk/api/components/appearance-controls-root" description="Controles de opacidad, visibilidad y radio de esquina." />
  <SdkCard title="TypographyControlsRoot" to="/programmable/sdk/api/components/typography-controls-root" description="Controles de fuente, alineación y formato." />
</SdkCardGroup>

## Selectores e inputs

<SdkCardGroup>
  <SdkCard title="ColorPickerRoot" to="/programmable/sdk/api/components/color-picker-root" description="Primitivo de selector de color basado en popover." />
  <SdkCard title="ColorInputRoot" to="/programmable/sdk/api/components/color-input-root" description="Helper headless de input de color." />
  <SdkCard title="FillPickerRoot" to="/programmable/sdk/api/components/fill-picker-root" description="Primitivo de selector de relleno basado en popover." />
  <SdkCard title="FontPickerRoot" to="/programmable/sdk/api/components/font-picker-root" description="Primitivo de selector de fuente con búsqueda." />
  <SdkCard title="GradientEditorRoot" to="/programmable/sdk/api/components/gradient-editor-root" description="Primitivo raíz para la edición de degradados." />
  <SdkCard title="GradientEditorBar" to="/programmable/sdk/api/components/gradient-editor-bar" description="Primitivo de barra de degradado arrastrable." />
  <SdkCard title="GradientEditorStop" to="/programmable/sdk/api/components/gradient-editor-stop" description="Primitivo de parada de degradado individual." />
  <SdkCard title="ScrubInputRoot" to="/programmable/sdk/api/components/scrub-input-root" description="Raíz del input numérico con arrastre para ajustar." />
  <SdkCard title="ScrubInputField" to="/programmable/sdk/api/components/scrub-input-field" description="Primitivo del campo de input editable." />
  <SdkCard title="ScrubInputDisplay" to="/programmable/sdk/api/components/scrub-input-display" description="Primitivo de visualización en modo no edición." />
</SdkCardGroup>

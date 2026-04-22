---
title: Componenti
description: Riferimento ai componenti per le primitive Vue headless in @open-pencil/vue.
---

# Componenti

`@open-pencil/vue` espone primitive strutturali headless per il cablaggio del canvas, UI di navigazione, pannelli proprietà e controlli di input mirati.

## Primitive principali dell'editor

<SdkCardGroup>
  <SdkCard title="CanvasRoot" to="/programmable/sdk/api/components/canvas-root" description="Struttura canvas headless e contesto." />
  <SdkCard title="CanvasSurface" to="/programmable/sdk/api/components/canvas-surface" description="Primitiva elemento canvas legata al contesto di CanvasRoot." />
  <SdkCard title="LayerTreeRoot" to="/programmable/sdk/api/components/layer-tree-root" description="Primitiva headless per l'albero dei layer." />
  <SdkCard title="LayerTreeItem" to="/programmable/sdk/api/components/layer-tree-item" description="Primitiva per una singola riga dell'albero dei layer." />
  <SdkCard title="ToolbarRoot" to="/programmable/sdk/api/components/toolbar-root" description="Primitiva headless per la toolbar." />
  <SdkCard title="ToolbarItem" to="/programmable/sdk/api/components/toolbar-item" description="Primitiva per un singolo strumento della toolbar." />
  <SdkCard title="PageListRoot" to="/programmable/sdk/api/components/page-list-root" description="Primitiva headless per la lista delle pagine." />
</SdkCardGroup>

## Primitive per il pannello proprietà

<SdkCardGroup>
  <SdkCard title="PropertyListRoot" to="/programmable/sdk/api/components/property-list-root" description="Primitiva headless per la lista delle proprietà." />
  <SdkCard title="PropertyListItem" to="/programmable/sdk/api/components/property-list-item" description="Primitiva per una singola riga di riempimenti, tratti o effetti." />
  <SdkCard title="PositionControlsRoot" to="/programmable/sdk/api/components/position-controls-root" description="Controlli di posizione, dimensione e trasformazione." />
  <SdkCard title="LayoutControlsRoot" to="/programmable/sdk/api/components/layout-controls-root" description="Controlli auto-layout e dimensionamento." />
  <SdkCard title="AppearanceControlsRoot" to="/programmable/sdk/api/components/appearance-controls-root" description="Controlli opacità, visibilità e raggio degli angoli." />
  <SdkCard title="TypographyControlsRoot" to="/programmable/sdk/api/components/typography-controls-root" description="Controlli font, allineamento e formattazione." />
</SdkCardGroup>

## Picker e input

<SdkCardGroup>
  <SdkCard title="ColorPickerRoot" to="/programmable/sdk/api/components/color-picker-root" description="Primitiva popover per la selezione del colore." />
  <SdkCard title="ColorInputRoot" to="/programmable/sdk/api/components/color-input-root" description="Helper headless per l'input del colore." />
  <SdkCard title="FillPickerRoot" to="/programmable/sdk/api/components/fill-picker-root" description="Primitiva popover per la selezione del riempimento." />
  <SdkCard title="FontPickerRoot" to="/programmable/sdk/api/components/font-picker-root" description="Primitiva searchable per la selezione del font." />
  <SdkCard title="GradientEditorRoot" to="/programmable/sdk/api/components/gradient-editor-root" description="Primitiva root per l'editor del gradiente." />
  <SdkCard title="GradientEditorBar" to="/programmable/sdk/api/components/gradient-editor-bar" description="Primitiva barra trascinabile per il gradiente." />
  <SdkCard title="GradientEditorStop" to="/programmable/sdk/api/components/gradient-editor-stop" description="Primitiva per un singolo stop del gradiente." />
  <SdkCard title="ScrubInputRoot" to="/programmable/sdk/api/components/scrub-input-root" description="Root per input numerico con trascinamento scrub." />
  <SdkCard title="ScrubInputField" to="/programmable/sdk/api/components/scrub-input-field" description="Primitiva campo di input per la modifica." />
  <SdkCard title="ScrubInputDisplay" to="/programmable/sdk/api/components/scrub-input-display" description="Primitiva di visualizzazione non in modifica." />
</SdkCardGroup>

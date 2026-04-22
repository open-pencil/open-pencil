---
title: Composants
description: Référence des composants pour les primitives Vue headless dans @open-pencil/vue.
---

# Composants

`@open-pencil/vue` expose des primitives structurelles headless pour le câblage canvas, l'UI de navigation, les panneaux de propriétés et les contrôles de saisie spécialisés.

## Primitives d'éditeur essentielles

<SdkCardGroup>
  <SdkCard title="CanvasRoot" to="/programmable/sdk/api/components/canvas-root" description="Structure canvas headless et contexte." />
  <SdkCard title="CanvasSurface" to="/programmable/sdk/api/components/canvas-surface" description="Primitive élément canvas lié au contexte CanvasRoot." />
  <SdkCard title="LayerTreeRoot" to="/programmable/sdk/api/components/layer-tree-root" description="Primitive headless pour l'arbre des calques." />
  <SdkCard title="LayerTreeItem" to="/programmable/sdk/api/components/layer-tree-item" description="Primitive pour une ligne de l'arbre des calques." />
  <SdkCard title="ToolbarRoot" to="/programmable/sdk/api/components/toolbar-root" description="Primitive headless pour la barre d'outils." />
  <SdkCard title="ToolbarItem" to="/programmable/sdk/api/components/toolbar-item" description="Primitive pour un outil individuel de la barre d'outils." />
  <SdkCard title="PageListRoot" to="/programmable/sdk/api/components/page-list-root" description="Primitive headless pour la liste des pages." />
</SdkCardGroup>

## Primitives de panneau de propriétés

<SdkCardGroup>
  <SdkCard title="PropertyListRoot" to="/programmable/sdk/api/components/property-list-root" description="Primitive headless pour les listes de propriétés." />
  <SdkCard title="PropertyListItem" to="/programmable/sdk/api/components/property-list-item" description="Primitive pour une ligne de remplissages, contours ou effets." />
  <SdkCard title="PositionControlsRoot" to="/programmable/sdk/api/components/position-controls-root" description="Contrôles de position, taille et transformation." />
  <SdkCard title="LayoutControlsRoot" to="/programmable/sdk/api/components/layout-controls-root" description="Contrôles d'auto-layout et de dimensionnement." />
  <SdkCard title="AppearanceControlsRoot" to="/programmable/sdk/api/components/appearance-controls-root" description="Contrôles d'opacité, visibilité et rayon de coin." />
  <SdkCard title="TypographyControlsRoot" to="/programmable/sdk/api/components/typography-controls-root" description="Contrôles de police, alignement et mise en forme." />
</SdkCardGroup>

## Sélecteurs et champs de saisie

<SdkCardGroup>
  <SdkCard title="ColorPickerRoot" to="/programmable/sdk/api/components/color-picker-root" description="Primitive de sélecteur de couleur basé sur un popover." />
  <SdkCard title="ColorInputRoot" to="/programmable/sdk/api/components/color-input-root" description="Helper headless pour la saisie de couleur." />
  <SdkCard title="FillPickerRoot" to="/programmable/sdk/api/components/fill-picker-root" description="Primitive de sélecteur de remplissage basé sur un popover." />
  <SdkCard title="FontPickerRoot" to="/programmable/sdk/api/components/font-picker-root" description="Primitive de sélecteur de police avec recherche." />
  <SdkCard title="GradientEditorRoot" to="/programmable/sdk/api/components/gradient-editor-root" description="Primitive racine pour l'édition de dégradés." />
  <SdkCard title="GradientEditorBar" to="/programmable/sdk/api/components/gradient-editor-bar" description="Primitive de barre de dégradé déplaçable." />
  <SdkCard title="GradientEditorStop" to="/programmable/sdk/api/components/gradient-editor-stop" description="Primitive pour un point d'arrêt de dégradé." />
  <SdkCard title="ScrubInputRoot" to="/programmable/sdk/api/components/scrub-input-root" description="Racine d'entrée numérique par glissement." />
  <SdkCard title="ScrubInputField" to="/programmable/sdk/api/components/scrub-input-field" description="Primitive de champ de saisie en mode édition." />
  <SdkCard title="ScrubInputDisplay" to="/programmable/sdk/api/components/scrub-input-display" description="Primitive d'affichage en mode non-édition." />
</SdkCardGroup>

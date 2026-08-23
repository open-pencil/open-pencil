---
title: Низкоуровневые API
description: Специализированные публичные API пакета @open-pencil/vue.
---

# Низкоуровневые API

Эти API входят в публичный пакет, но предназначены для более узких задач, чем основные компоненты и composables.

## Выделение и SceneGraph

- [useNodeProps](./use-node-props)
- [useSceneComputed](./use-scene-computed)
- [usePropScrub](./use-prop-scrub)

## Выбор значений, переменные, язык и состояние редактора

- [useColorVariableBinding](./use-color-variable-binding)
- [useGradientStops](./use-gradient-stops)
- [useFontPicker](./use-font-picker)
- [useOkHCL](./use-okhcl)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
- [API языка](./locale-apis)
- [useToolbarState](./use-toolbar-state)
- [useNodeFontStatus](./use-node-font-status)

## Собственные интерфейсы редактора

- [useLayerDrag](./use-layer-drag)
- [useInlineRename](./use-inline-rename)
- [useCanvasDrop](./use-canvas-drop)
- [extractImageFilesFromClipboard](./extract-image-files-from-clipboard)
- [useViewportKind](./use-viewport-kind)
- [toolCursor](./tool-cursor)

## Контекст компонентов

- [useCanvasContext](./use-canvas-context)
- [useLayerTree](./use-layer-tree)
- [useToolbar](./use-toolbar)
- [usePropertyList](./use-property-list)
- [useNumberField](/programmable/sdk/api/advanced/use-number-field)

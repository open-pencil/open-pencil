# @open-pencil/vue

Headless Vue 3 SDK for building OpenPencil-powered editors.

`@open-pencil/vue` sits on top of `@open-pencil/core` and provides:

- Vue editor injection via `provideEditor()` / `useEditor()`
- canvas integration via `useCanvas()`, `useCanvasInput()`, and `useTextEdit()`
- selection, command, panel, variables, and i18n composables
- headless structural primitives like `CanvasRoot`, `LayerTreeRoot`, `PageListRoot`, and `ToolbarRoot`

The SDK is headless by design: it provides logic and structure, while your app owns styling and product-specific UI.

## Install

```bash
bun add @open-pencil/vue @open-pencil/core @open-pencil/scene-graph canvaskit-wasm
```

The current development version requires Vue `^3.5.41` and, when supplying the optional CanvasKit peer, `canvaskit-wasm >=0.41.1`. See [SDK Getting Started](https://openpencil.dev/programmable/sdk/getting-started) for migration guidance; older releases may have different peer requirements.

## Quick start

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { createDefaultEditorState, createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'
import { CanvasRoot, CanvasSurface, provideEditor } from '@open-pencil/vue'

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')

const editor = createEditor({
  graph,
  state: reactive(createDefaultEditorState(page.id)),
  getViewportSize: () => ({ width: 1200, height: 800 }),
})

editor.createShape('RECTANGLE', 100, 100, 200, 150)
editor.zoomToFit()

provideEditor(editor)
</script>

<template>
  <div class="h-screen">
    <CanvasRoot>
      <CanvasSurface class="size-full" />
    </CanvasRoot>
  </div>
</template>
```

The fixed viewport size above is illustrative; a resizable shell should return its actual canvas container dimensions from `getViewportSize`. Pass reactive state for Vue controls, while keeping the Scene Graph itself framework-neutral.

## Core concepts

### Editor context

Use `provideEditor(editor)` once near the top of your subtree.

```ts
import { provideEditor } from '@open-pencil/vue'

provideEditor(editor)
```

Read it anywhere below with `useEditor()`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

### Canvas wiring

At the composable level, the main canvas APIs are:

- `useCanvas()`
- `useCanvasInput()`
- `useTextEdit()`
- `PlayIslands`

If you want SDK-provided structure, use headless primitives like `CanvasRoot` and `CanvasSurface`.

`PlayIslands` previews a canvas pane: place it over the canvas with the pane's view state, and while the pane's `play` state is set, each top-level layer holding components with behaviours runs as live Reka UI components in its own shadow root.

### Headless primitives

Main structural primitives include:

- `CanvasRoot`
- `LayerTreeRoot`
- `PageListRoot`
- `PropertyListRoot`
- `PropertySectionRoot`
- `SegmentedControlRoot`
- `ToolbarRoot`
- `ColorPickerRoot`
- `FontPickerRoot`
- `NumberFieldRoot` / `NumberFieldInput` / `NumberFieldValue`
- `BindableValueRoot` / `BindableValueTrigger` / `BindableValuePicker`
- `LayoutControlsRoot`
- `ConstraintsControlRoot`

These components coordinate structure and state, but do not impose app styling. `NumberField`
adds pointer scrubbing, Arrow-key stepping, mixed/bound state attributes, and safe arithmetic
expressions such as `+10`, `*2`, `50%`, and `12*8+4`. `BindableValue` composes fields with a
generic `BindingProvider` and supports detach-on-edit, read-only, and edit-variable policies.
Focusing a bound NumberField is non-destructive; the configured policy begins only on the first
value mutation. `LayoutControlsRoot` exposes axis-oriented sizing actions; editing a Hug or Fill
dimension can switch that axis to Fixed inside the same provider transaction.
`ConstraintsControlRoot` exposes eligible frame-child constraints, mixed axis values, pin actions,
and undo-batched multi-selection updates. `AppearanceControlsRoot`
exposes selection-derived independent-corner presentation state so consumers do not need parallel
expansion heuristics. `PropertyListRoot` is controlled and
editor-agnostic; OpenPencil panels connect it to selection and undo through
`useEditorPropertyList()`. `useColorModel()` provides precise scene-color/Reka bridges, reactive
RGB/HSL/HSB/OkHCL channels, extensible format state, and shared slider presentation data.
`FillRoot` and `FillSwatch` separate fill behavior and binding-aware previews from popover
composition; `ChannelSlider` provides accessible scalar OkHCL controls until Reka supports them.

## Public API tiers

### Core API

These are the main APIs most SDK consumers should start with.

#### Context and canvas

- `provideEditor()`
- `useEditor()`
- `useCanvas()`
- `useCanvasInput()`
- `useTextEdit()`

#### Selection and commands

- `useSelectionState()`
- `useSelectionCapabilities()`
- `useEditorCommands()`
- `useMenuModel()`

#### Property panels

- `usePosition()`
- `useLayout()`
- `useConstraints()`
- `useComponentProperties()`
- `useAppearance()`
- `useSharedStyleBinding()`
- `useColorModel()`
- `useMask()`
- `useTypography()`
- `useExport()`
- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

#### Variables, navigation, and localization

- `usePageList()`
- `useI18n()`

#### Headless primitives

- `CanvasRoot`
- `LayerTreeRoot`
- `PageListRoot`
- `PropertyListRoot`
- `PropertyListItem`
- `PropertyListAdd` / `PropertyListRemove` / `PropertyListVisibility`
- `PropertySectionRoot` / `PropertySectionHeader` / `PropertySectionTitle`
- `PropertySectionActions` / `PropertySectionContent` / `PropertySectionEmptyAction`
- `SegmentedControlRoot` / `SegmentedControlItem`
- `ToolbarRoot`
- `NumberFieldRoot`
- `NumberFieldInput`
- `NumberFieldValue`
- `NumberFieldLeading`
- `NumberFieldUnit`
- `NumberFieldTrailing`
- `NumberFieldMenu`
- `BindableValueRoot`
- `BindableValueTrigger`
- `BindableValuePicker`
- `FillRoot` / `FillSwatch`
- `ChannelSliderRoot` / `ChannelSliderTrack` / `ChannelSliderThumb`

### Advanced API

These exports are intentionally public, but they are lower-level or more specialized.

- `useNodeProps()`
- `useEditorPropertyList()`
- `useSceneComputed()`
- `useColorBindingProvider()`
- `useColorVariableBinding()`
- `provideBindingProvider()`
- `useBindingProvider()`
- `useNumberBindingProvider()`
- `useFill()`
- `useGradientStops()`
- `useFontPicker()`
- `useOkHCL()`
- `useVariables()`
- `usePropScrub()`
- `useLayerDrag()`
- `useInlineRename()`
- `useToolbarState()`
- `useNodeFontStatus()`
- `useCanvasDrop()`
- `extractImageFilesFromClipboard()`
- `useViewportKind()`
- `toolCursor()`

### Primitive context helpers and low-level stores

These are mostly useful when extending SDK primitives rather than building from top-level composables.

- `useCanvasContext()`
- `useLayerTree()`
- `useToolbar()`
- `usePropertyList()`
- `useNumberField()`
- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

## Example patterns

### Minimal provider component

```vue
<script setup lang="ts">
import { provideEditor } from '@open-pencil/vue'

import type { Editor } from '@open-pencil/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

### Read selection state

```ts
import { useSelectionState } from '@open-pencil/vue'

const { hasSelection, selectedCount, selectedNode } = useSelectionState()
```

### Build a menu

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu } = useMenuModel()
```

### Build a page list

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage }">
  <ul>
    <li v-for="page in pages" :key="page.id">
      <button :data-active="page.id === currentPageId" @click="switchPage(page.id)">
        {{ page.name }}
      </button>
    </li>
  </ul>
</PageListRoot>
```

## Documentation

For fuller guides and API docs, see the documentation site:

- `packages/docs/programmable/sdk/`

## Example app

Run the included example:

```bash
cd packages/vue/example
bun install
bun run dev
```

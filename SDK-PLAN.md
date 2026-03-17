# @open-pencil/vue SDK Redesign Plan

Goal: Reka UI-style headless components for building editors like OpenPencil.
OpenPencil app becomes a styled composition of these primitives.

## Principles

1. Every app component maps to an SDK headless primitive
2. Reka UI naming: `XxxRoot`, `XxxItem`, `XxxTrigger` with `v-slot`
3. No app opinions — no icons, cursors, toast, constants, styling
4. Composable over component when headless (no DOM = composable)
5. App = styled SDK composition

## SDK Component Inventory

### Canvas

| SDK | Type | Slot props / API |
|-----|------|-----------------|
| `CanvasRoot` | Component | Provides editor context + canvas lifecycle |
| `CanvasSurface` | Component | `<canvas>` with render loop, `@ready` event |
| `useCanvasInput()` | Composable | Mouse/touch/gesture, cursor override |
| `usePanZoom()` | Composable | Wheel, pinch, pan |
| `useTextEdit()` | Composable | Text editing, IME, caret |
| `useCanvasDrop()` | Composable | File drag-and-drop |

### Layers

| SDK | Type | Slot props |
|-----|------|-----------|
| `LayerTreeRoot` | Component | Tree data, expand/collapse, selection |
| `LayerTreeItem` | Component | DnD, rename, visibility, lock per row |

### Pages

| SDK | Type | Slot props |
|-----|------|-----------|
| `PageList` | Component | pages, currentPageId, switchPage, addPage, deletePage |

### Toolbar

| SDK | Type | Slot props |
|-----|------|-----------|
| `ToolbarRoot` | Component | activeTool, tools, flyouts |
| `ToolbarItem` | Component | active state, select handler |

### Properties

| SDK | Type | Slot props |
|-----|------|-----------|
| `useNodeProps()` | Composable | Selection-aware property editing with undo |
| `PositionControls` | Component | x, y, w, h, rotation, alignment actions |
| `FillList` | Component | Fill array CRUD, variable binding |
| `StrokeList` | Component | Stroke array CRUD, side/weight |
| `EffectList` | Component | Effect array CRUD |
| `AppearanceControls` | Component | Corner radius, opacity, blend, visibility |
| `TypographyControls` | Component | Font family/weight/size, alignment, decoration |
| `LayoutControls` | Component | Auto-layout/grid, sizing, padding, alignment |
| `ExportControls` | Component | Format/scale, export trigger |
| `PageControls` | Component | Page background color |
| `VariablesIndicator` | Component | Variable count |

### Color

| SDK | Type | Slot props |
|-----|------|-----------|
| `FillPickerRoot` | Component | Fill type tabs, delegates to sub-pickers |
| `GradientEditorRoot` | Component | Stops, subtype |
| `GradientEditorBar` | Component | Draggable stop bar |
| `GradientEditorStop` | Component | Single stop |
| `ImageFillControls` | Component | Preview, file picker, scale mode |
| `ColorPickerRoot` | Component | Color popover |
| `ColorInput` | Component | Swatch + hex |

### Variables

| SDK | Type | Slot props |
|-----|------|-----------|
| `VariablesEditorRoot` | Component | Collection tabs, variable table CRUD |

### Menus

| SDK | Type | Slot props |
|-----|------|-----------|
| `EditorContextMenu` | Component | Selection-aware context menu items |
| `EditorMenuBar` | Component | File/Edit/View menu structure |

### Inputs

| SDK | Type | Slot props |
|-----|------|-----------|
| `ScrubInput` | Component | Drag-to-change number input |
| `FontPicker` | Component | Font family combobox |

### Composables (existing, keep)

| SDK | Purpose |
|-----|---------|
| `useEditor()` | Inject editor |
| `useSelectionState()` | Reactive selection queries |
| `useNodeProps()` | Property editing with undo |
| `useInlineRename()` | Inline rename input |
| `useLayerDrag()` | Atlaskit tree DnD |
| `useFontStatus()` | Font loading state |

## NOT in SDK (app-specific)

- `chat/` (6 files) — AI providers, ACP
- `CollabPanel` — P2P/Yjs
- `MobileHud`, `MobileDrawer` — app mobile layout
- `SafariBanner` — browser detection
- `TabBar` — multi-tab files
- `AppToast` — toast styling
- `CodePanel` — JSX generation
- `use-collab.ts`, `use-chat.ts`, `use-keyboard.ts`, `use-menu.ts`

## Migration Phases

### Phase 1: Establish pattern (3 exemplars)
- `ScrubInput` — pure UI, no editor dep
- `PageList` — clean up existing
- `ToolbarRoot`/`ToolbarItem` — headless tool selector

### Phase 2: Canvas primitives
- `CanvasRoot`/`CanvasSurface`
- Clean `useCanvasInput`, `usePanZoom`, `useTextEdit`, `useCanvasDrop`

### Phase 3: Property primitives
- `FillList`, `StrokeList`, `EffectList`
- `PositionControls`, `AppearanceControls`, `TypographyControls`, `LayoutControls`
- Move `ScrubInput`, `ColorInput`, `FontPicker` to SDK

### Phase 4: Layer tree primitives
- `LayerTreeRoot`/`LayerTreeItem` with Atlaskit DnD
- Rename, selection sync

### Phase 5: Menu primitives
- `EditorContextMenu`, `EditorMenuBar`

### Phase 6: Dialog/picker primitives
- `VariablesEditorRoot`
- `FillPickerRoot`, `GradientEditorRoot`, `ImageFillControls`
- `ExportControls`

### Phase 7: App migration
- Rewrite every app component as styled SDK composition
- App files = styling + layout only

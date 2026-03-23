# @open-pencil/vue architecture

## Folder conventions

- `Canvas/`, `ColorPicker/`, `FillPicker/`, `FontPicker/`, `GradientEditor/`, `LayerTree/`, `PageList/`, `PropertyList/`, `ScrubInput/`, `Toolbar/` — component families and colocated helpers for structural/headless primitives
- `controls/` — editor control composables used by app property panels (`useAppearance`, `useLayout`, `usePosition`, `useTypography`, `useFillControls`, `useStrokeControls`, `useEffectsControls`, `useExport`, `useNodeProps`, `usePropScrub`)
- `VariablesEditor/` — variables domain composables and table wiring
- `selection/` — selection-focused composables (`useSelectionState`, `useSelectionCapabilities`)
- `context/` — dependency injection helpers (`editorContext`, `createContext`)
- `internal/` — cross-cutting internals not intended as primary public primitives (`useSceneComputed`, `toolCursor`)
- `shared/` — remaining cross-domain helpers that are still generic and not yet better served by a domain folder

## Naming conventions

- Composable filenames match export names: `useFillControls.ts`, `useVariablesEditor.ts`
- Structural primitives follow Reka-style anatomy naming: `XxxRoot`, `XxxItem`, `XxxTrigger`
- Prefer composables over thin root wrappers when there is no meaningful structural UI coordination

## Public API guidance

- Export stable, intentional entry points from `src/index.ts`
- Prefer composables for property-panel/editor logic
- Prefer component families for true headless UI primitives with internal coordination

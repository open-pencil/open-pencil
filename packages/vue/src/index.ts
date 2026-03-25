export type {
  Editor,
  EditorState,
  EditorOptions,
  Tool,
  EditorToolDef
} from '@open-pencil/core/editor'
export { createEditor, EDITOR_TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core/editor'

/**
 * Public editor-context API for the Vue SDK.
 *
 * These are the primary entry points for making an editor available to a Vue
 * subtree and reading it back inside composables and headless primitives.
 */
export { provideEditor, useEditor, EDITOR_KEY } from './context/editorContext'

/** Canvas and input integration composables. */
export { useCanvas } from './shared/useCanvas'
export type { UseCanvasOptions } from './shared/useCanvas'
export { useCanvasInput } from './Canvas/useCanvasInput'
export { useTextEdit } from './Canvas/useTextEdit'
export { useCanvasDrop, extractImageFilesFromClipboard } from './Canvas/useCanvasDrop'

/** Low-level selection, graph, and derived-state helpers. */
export { useNodeProps, MIXED } from './controls/useNodeProps'
export type { MixedValue } from './controls/useNodeProps'
export { useSceneComputed } from './internal/useSceneComputed'
export { useSelectionState } from './selection/useSelectionState'
export { useSelectionCapabilities } from './selection/useSelectionCapabilities'

/** Command and menu composition helpers. */
export { useEditorCommands } from './commands/useEditorCommands'
export type { EditorCommand, EditorCommandId } from './commands/useEditorCommands'
export { useMenuModel } from './commands/useMenuModel'
export type { MenuEntry } from './commands/useMenuModel'

/** Miscellaneous editor-shell helpers. */
export { useViewportKind } from './viewport/useViewportKind'
export { useLayerDrag } from './LayerTree/useLayerDrag'
export { useInlineRename } from './shared/useInlineRename'
export { useToolbarState } from './Toolbar/useToolbarState'
export { useNodeFontStatus } from './shared/useFontStatus'
export { usePropScrub } from './controls/usePropScrub'
export { toolCursor } from './internal/toolCursor'

/** Property-panel composables. */
export { usePosition } from './controls/usePosition'
export { useLayout } from './controls/useLayout'
export { useAppearance } from './controls/useAppearance'
export { useTypography } from './controls/useTypography'
export type { UseTypographyOptions } from './controls/useTypography'
export { useExport } from './controls/useExport'
export { useFillControls } from './controls/useFillControls'
export { useFillVariableBinding } from './controls/useFillVariableBinding'
export { useEffectsControls } from './controls/useEffectsControls'
export { useStrokeControls } from './controls/useStrokeControls'

/** Variables, page navigation, and picker helpers. */
export { useVariables } from './VariablesEditor/useVariables'
export { useVariablesDialogState } from './VariablesEditor/useVariablesDialogState'
export { useVariablesEditor } from './VariablesEditor/useVariablesEditor'
export { useVariablesTable } from './VariablesEditor/useVariablesTable'
export { usePageList } from './PageList/usePageList'
export { useFillPicker } from './FillPicker/useFillPicker'
export { useGradientStops } from './GradientEditor/useGradientStops'
export { useFontPicker } from './FontPicker/useFontPicker'

/** Headless structural primitives and their local contexts. */
export { CanvasRoot, CanvasSurface, useCanvasContext } from './Canvas'
export type { CanvasContext } from './Canvas'
export { ColorInputRoot, ColorPickerRoot } from './ColorPicker'
export { FillPickerRoot } from './FillPicker'
export { FontPickerRoot } from './FontPicker'
export { GradientEditorRoot, GradientEditorBar, GradientEditorStop } from './GradientEditor'
export { LayerTreeRoot, LayerTreeItem, useLayerTree } from './LayerTree'
export type { LayerTreeContext, LayerNode } from './LayerTree'
export { LayoutControlsRoot } from './LayoutControls'
export { AppearanceControlsRoot } from './AppearanceControls'
export { PageListRoot } from './PageList'
export { PositionControlsRoot } from './PositionControls'
export { PropertyListRoot, PropertyListItem, usePropertyList } from './PropertyList'
export type { PropertyListContext } from './PropertyList'
export { ScrubInputRoot, ScrubInputField, ScrubInputDisplay, useScrubInput } from './ScrubInput'
export type { ScrubInputContext } from './ScrubInput'
export { TypographyControlsRoot } from './TypographyControls'
export { ToolbarRoot, ToolbarItem, useToolbar } from './Toolbar'
export type { ToolbarContext } from './Toolbar'

/** Internationalization. */
export { useI18n } from './i18n'
export { locale, localeSetting, setLocale, AVAILABLE_LOCALES } from './i18n'
export type { Locale } from './i18n'
export {
  menuMessages,
  commandMessages,
  toolMessages,
  panelMessages,
  pageMessages,
  dialogMessages
} from './i18n'

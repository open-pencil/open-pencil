export type {
  Editor,
  EditorState,
  EditorOptions,
  EditorEvents,
  EditorEventName,
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
export { provideEditor, useEditor, EDITOR_KEY } from '#vue/editor/context'

/** Canvas and input integration composables. */
export { useCanvas } from '#vue/canvas/surface/use'
export type { UseCanvasOptions } from '#vue/canvas/surface/use'
export { useCanvasInput } from '#vue/canvas/useCanvasInput'
export { useCanvasVirtualReference } from '#vue/canvas/overlays/useCanvasVirtualReference'
export { useTextEdit } from '#vue/canvas/text-edit/use'
export { useCanvasDrop, extractImageFilesFromClipboard } from '#vue/canvas/drop/use'

/** Low-level selection, graph, and derived-state helpers. */
export { useNodeProps, MIXED } from '#vue/controls/node-props/use'
export type { MixedValue } from '#vue/controls/node-props/use'
export { useSceneComputed } from '#vue/internal/scene-computed/use'
export { useSelectionState } from '#vue/editor/selection-state/use'
export { useEditorEvent } from '#vue/editor/events/use'
export { useSelectionCapabilities } from '#vue/editor/selection-capabilities/use'

/** Command and menu composition helpers. */
export { useEditorCommands } from '#vue/editor/commands/use'
export type { EditorCommand, EditorCommandId } from '#vue/editor/commands/use'
export { useMenuModel } from '#vue/editor/menu-model/use'
export type { MenuActionNode, MenuEntry, MenuSeparatorNode } from '#vue/editor/menu-model/use'

/** Miscellaneous editor-shell helpers. */
export { useViewportKind } from '#vue/editor/viewport-kind/use'
export { useLayerDrag } from '#vue/primitives/LayerTree/useLayerDrag'
export { useInlineRename } from '#vue/editor/inline-rename/use'
export { useToolbarState } from '#vue/primitives/Toolbar/useToolbarState'
export { useNodeFontStatus } from '#vue/shared/font-status/use'
export { usePropScrub } from '#vue/controls/prop-scrub/use'
export { toolCursor } from '#vue/editor/tool-cursor'
export {
  acpPermissionOptionTestId,
  testId,
  testIdSelector,
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId,
  variablesAddTestId
} from '#vue/testing/test-id'
export { vTestId } from '#vue/testing/v-test-id'
export type {
  RequiredTestIdProps,
  TestId,
  TestIdProps,
  WithoutTestId,
  WithRequiredTestId,
  WithTestId
} from '#vue/testing/test-id'

/** Property-panel composables. */
export { usePosition } from '#vue/controls/position/use'
export { useLayout } from '#vue/controls/layout/use'
export type { SizeLimitProp } from '#vue/controls/layout/helpers'
export { useAppearance } from '#vue/controls/appearance/use'
export { useTypography } from '#vue/controls/typography/use'
export type { UseTypographyOptions } from '#vue/controls/typography/use'
export { useExport } from '#vue/document/export/use'
export type { ExportFormatId } from '#vue/document/export/use'
export { useFillControls } from '#vue/controls/fill/use'
export { useColorVariableBinding } from '#vue/controls/color-variable-binding/use'
export { useNumberVariableBinding } from '#vue/controls/number-variable-binding/use'
export type { NumberBindingPath } from '#vue/controls/number-variable-binding/use'
export { useVariableBinding } from '#vue/controls/variable-binding/use'
export type {
  VariableBindingState,
  UseVariableBindingOptions
} from '#vue/controls/variable-binding/use'
export { useEffectsControls } from '#vue/controls/effects/use'
export { useStrokeControls } from '#vue/controls/stroke/use'
export { useOkHCL } from '#vue/controls/okhcl/use'

/** Variables, page navigation, and picker helpers. */
export { useVariables } from '#vue/variables/use'
export { useVariablesDialogState } from '#vue/variables/dialog/use'
export { useVariablesEditor } from '#vue/variables/editor/use'
export { useVariablesTable } from '#vue/variables/table/use'
export { usePageList } from '#vue/primitives/PageList/usePageList'
export { useFillPicker } from '#vue/primitives/FillPicker/useFillPicker'
export { useGradientStops } from '#vue/primitives/GradientEditor/useGradientStops'
export { useFontPicker } from '#vue/primitives/FontPicker/useFontPicker'

/** Headless structural primitives and their local contexts. */
export { CanvasRoot, CanvasSurface, useCanvasContext } from '#vue/canvas'
export type { CanvasContext } from '#vue/canvas'
export {
  ColorInputRoot,
  ColorPickerRoot,
  createColorPickerModel,
  createOkHCLSliderGradientModel,
  createOkHCLSliderPreviewModel,
  createSliderGradientModel,
  createSliderPreviewModel,
  fromPercent,
  rekaToAppColor,
  toPercent,
  updateAlpha,
  updateHSBChannel,
  updateHSLChannel,
  updateHue,
  updateRGBChannel,
  applySolidFillColor,
  applySolidStrokeColor
} from '#vue/primitives/ColorPicker'
export type { ColorFieldFormat, OkHCLControls } from '#vue/primitives/ColorPicker'
export { FillPickerRoot } from '#vue/primitives/FillPicker'
export { FontPickerRoot } from '#vue/primitives/FontPicker'
export type { FontPickerUi } from '#vue/primitives/FontPicker'
export {
  GradientEditorRoot,
  GradientEditorBar,
  GradientEditorStop
} from '#vue/primitives/GradientEditor'
export { LayerTreeRoot, LayerTreeItem, useLayerTree } from '#vue/primitives/LayerTree'
export type { LayerTreeContext, LayerNode } from '#vue/primitives/LayerTree'
export { LayoutControlsRoot, useLayoutControlsContext } from '#vue/primitives/LayoutControls'
export type { LayoutControlsContext } from '#vue/primitives/LayoutControls'
export { AppearanceControlsRoot } from '#vue/primitives/AppearanceControls'
export { PageListRoot } from '#vue/primitives/PageList'
export { PositionControlsRoot } from '#vue/primitives/PositionControls'
export { PropertyListRoot, PropertyListItem, usePropertyList } from '#vue/primitives/PropertyList'
export type { PropertyListContext } from '#vue/primitives/PropertyList'
export {
  ScrubInputRoot,
  ScrubInputField,
  ScrubInputDisplay,
  useScrubInput
} from '#vue/primitives/ScrubInput'
export type { ScrubInputContext } from '#vue/primitives/ScrubInput'
export { TypographyControlsRoot } from '#vue/primitives/TypographyControls'
export { ToolbarRoot, ToolbarItem, useToolbar } from '#vue/primitives/Toolbar'
export type { ToolbarContext } from '#vue/primitives/Toolbar'

/** DOM event helpers for cast-free template bindings. */
export { blurTarget, inputNumberValue, inputValue, selectTarget } from '#vue/shared/dom-events'

/** Internationalization. */
export { useI18n } from '#vue/i18n'
export { locale, localeSetting, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '#vue/i18n'
export type { Locale } from '#vue/i18n'
export {
  menuMessages,
  commandMessages,
  toolMessages,
  panelMessages,
  pageMessages,
  dialogMessages
} from '#vue/i18n'

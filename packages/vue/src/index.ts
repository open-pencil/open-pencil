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
export { EDITOR_COMMAND_METADATA, editorCommandMetadata } from '#vue/editor/commands/registry'
export { formatShortcut, shortcutPlatform } from '#vue/editor/commands/shortcut'
export type { EditorCommandMetadata } from '#vue/editor/commands/registry'
export type { ShortcutPlatform } from '#vue/editor/commands/shortcut'
export type { EditorCommand, EditorCommandId } from '#vue/editor/commands/use'
export { useMenuModel } from '#vue/editor/menu-model/use'
export type { MenuActionNode, MenuEntry, MenuSeparatorNode } from '#vue/editor/menu-model/use'

/** Miscellaneous editor-shell helpers. */
export { useViewportKind } from '#vue/editor/viewport-kind/use'
export { useLayerDrag } from '#vue/primitives/LayerTree/useLayerDrag'
export { useFlatReorderDrag } from '#vue/shared/drag/useFlatReorderDrag'
export type {
  FlatReorderAxis,
  FlatReorderInstruction,
  FlatReorderItem,
  UseFlatReorderDragOptions
} from '#vue/shared/drag/useFlatReorderDrag'
export { useInlineRename } from '#vue/editor/inline-rename/use'
export {
  getToolbarToolSelection,
  isToolbarToolActive,
  useToolbarState
} from '#vue/primitives/Toolbar/useToolbarState'
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
export type { TestId } from '#vue/testing/test-id'

/** Property-panel composables. */
export { usePosition } from '#vue/controls/position/use'
export { useLayout } from '#vue/controls/layout/use'
export type { LayoutAxis, SizeLimitProp } from '#vue/controls/layout/helpers'
export { useAppearance } from '#vue/controls/appearance/use'
export { useMask } from '#vue/controls/mask/use'
export { useTypography } from '#vue/controls/typography/use'
export type { UseTypographyOptions } from '#vue/controls/typography/use'
export { useExport } from '#vue/document/export/use'
export type { ExportFormatId, ExportSetting } from '#vue/document/export/use'
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
export { useSharedStyleBinding } from '#vue/controls/shared-style/use'
export { useStrokeControls } from '#vue/controls/stroke/use'
export {
  applySolidFillColor,
  applySolidStrokeColor,
  BUILT_IN_COLOR_FORMATS,
  fromPercent,
  toPercent,
  useColorModel
} from '#vue/controls/color-model'
export type {
  BuiltInColorFormat,
  ColorFieldFormat,
  ColorFieldOption,
  OkHCLControls,
  UseColorModelOptions
} from '#vue/controls/color-model'
export { useOkHCL } from '#vue/controls/okhcl/use'

/** Variables, page navigation, and picker helpers. */
export { useVariables } from '#vue/variables/use'
export { useVariablesDialogState } from '#vue/variables/dialog/use'
export { useVariablesEditor } from '#vue/variables/editor/use'
export { useVariablesTable } from '#vue/variables/table/use'
export { usePageList } from '#vue/primitives/PageList/usePageList'
export {
  fillCategory,
  fillIsTransparent,
  fillSwatchBackground,
  useFill
} from '#vue/primitives/Fill'
export type { FillActions, FillCategory } from '#vue/primitives/Fill'
export { useGradientStops } from '#vue/primitives/GradientEditor/useGradientStops'
export { useFontPicker } from '#vue/primitives/FontPicker/useFontPicker'

/** Headless structural primitives and their local contexts. */
export { CanvasRoot, CanvasSurface, useCanvasContext } from '#vue/canvas'
export type { CanvasContext } from '#vue/canvas'
export { ColorInputRoot, ColorPickerRoot } from '#vue/primitives/ColorPicker'
export {
  ChannelSliderRoot,
  ChannelSliderThumb,
  ChannelSliderTrack
} from '#vue/primitives/ChannelSlider'
export type {
  ChannelSliderOrientation,
  ChannelSliderPartProps,
  ChannelSliderRootProps,
  ChannelSliderRootSlotProps,
  ChannelSliderThumbSlotProps
} from '#vue/primitives/ChannelSlider'
export { FillRoot, FillSwatch } from '#vue/primitives/Fill'
export type {
  FillRootSlotProps,
  FillRootSlots,
  FillSwatchProps,
  FillSwatchSlotProps,
  FillSwatchSlots
} from '#vue/primitives/Fill'
export { FontPickerRoot } from '#vue/primitives/FontPicker'
export type { FontFamilyOption, FontPickerUI } from '#vue/primitives/FontPicker'
export {
  GradientEditorRoot,
  GradientEditorBar,
  GradientEditorStop
} from '#vue/primitives/GradientEditor'
export type {
  GradientEditorStopActions,
  GradientEditorStopProps,
  GradientEditorStopSlotProps,
  GradientEditorStopSlots
} from '#vue/primitives/GradientEditor'
export {
  buildLayerTreeModel,
  indexLayerNodes,
  layerSelectionForTarget,
  LayerTreeItem,
  LayerTreeRoot,
  patchLayerNode,
  useLayerTree,
  visibleLayerRows
} from '#vue/primitives/LayerTree'
export type {
  LayerDragInstruction,
  LayerNode,
  LayerRow,
  LayerSelectionMode,
  LayerTreeContext,
  LayerTreeVirtualizer
} from '#vue/primitives/LayerTree'
export { LayoutControlsRoot, useLayoutControlsContext } from '#vue/primitives/LayoutControls'
export type {
  LayoutControlsContext,
  LayoutControlsRootSlotProps,
  LayoutControlsRootSlots
} from '#vue/primitives/LayoutControls'
export { AppearanceControlsRoot } from '#vue/primitives/AppearanceControls'
export type {
  AppearanceControlsActions,
  AppearanceControlsRootSlotProps,
  AppearanceControlsRootSlots
} from '#vue/primitives/AppearanceControls'
export { ConstraintsControlRoot } from '#vue/primitives/ConstraintsControl'
export type {
  ConstraintsControlActions,
  ConstraintsControlRootSlotProps,
  ConstraintsControlRootSlots
} from '#vue/primitives/ConstraintsControl'
export {
  constraintPins,
  isConstraintEligible,
  toggleConstraintPin,
  useConstraints
} from '#vue/controls/constraints'
export type { ConstraintAxis, ConstraintEdge, ConstraintValue } from '#vue/controls/constraints'
export {
  compatibleComponentPropertyDefinitions,
  instanceSwapOptions,
  mergedComponentPropertyValue,
  useComponentProperties
} from '#vue/controls/component-props'
export type {
  ComponentPropertyControl,
  ComponentPropertyOption
} from '#vue/controls/component-props'
export type { CornerGeometryKey, CornerRadiusKey } from '#vue/controls/appearance/types'
export { PageListRoot } from '#vue/primitives/PageList'
export { PositionControlsRoot } from '#vue/primitives/PositionControls'
export { useEditorPropertyList } from '#vue/controls/property-list'
export {
  PropertyListRoot,
  PropertyListItem,
  PropertyListAdd,
  PropertyListRemove,
  PropertyListVisibility,
  usePropertyList
} from '#vue/primitives/PropertyList'
export type {
  PropertyListActions,
  PropertyListContext,
  PropertyListIdentity,
  PropertyListItemActions,
  PropertyListItemFor,
  PropertyListItemMap,
  PropertyListItemSlotProps,
  PropertyListKey,
  PropertyListPartProps,
  PropertyListPatchFor,
  PropertyListRootProps,
  PropertyListRootSlotProps,
  PropertyListRootSlots
} from '#vue/primitives/PropertyList'
export {
  PropertySectionRoot,
  PropertySectionHeader,
  PropertySectionTitle,
  PropertySectionActions,
  PropertySectionContent,
  PropertySectionEmptyAction,
  usePropertySection
} from '#vue/primitives/PropertySection'
export type {
  PropertySectionActionAPI,
  PropertySectionContext,
  PropertySectionPartProps,
  PropertySectionRootProps,
  PropertySectionRootSlots,
  PropertySectionSlotProps,
  PropertySectionStateAttrs
} from '#vue/primitives/PropertySection'
export {
  SegmentedControlRoot,
  SegmentedControlItem,
  useSegmentedControl
} from '#vue/primitives/SegmentedControl'
export type {
  SegmentedControlContext,
  SegmentedControlItemProps,
  SegmentedControlItemSlotProps,
  SegmentedControlItemSlots,
  SegmentedControlMode,
  SegmentedControlOrientation,
  SegmentedControlRootProps,
  SegmentedControlRootSlots
} from '#vue/primitives/SegmentedControl'
export {
  BindableValueRoot,
  BindableValueTrigger,
  BindableValuePicker,
  useBindableValue,
  useOptionalBindableValue
} from '#vue/primitives/BindableValue'
export type {
  BindableValueActions,
  BindableValueContext,
  BindableValueRootProps,
  BindableValueRootSlots,
  BindableValueSlotProps,
  BindableValueStateAttrs,
  BindableValueTriggerProps
} from '#vue/primitives/BindableValue'
export {
  provideBindingProvider,
  useBindingProvider,
  useOpenPencilBindingProvider,
  useNumberBindingProvider,
  useColorBindingProvider
} from '#vue/controls/binding-provider'
export type {
  BindingMutationSource,
  BindingProvider,
  BindingState,
  BindingTarget,
  BoundEditPolicy,
  OpenPencilBindingProviderOptions
} from '#vue/controls/binding-provider'
export {
  NumberFieldRoot,
  NumberFieldInput,
  NumberFieldValue,
  NumberFieldLeading,
  NumberFieldUnit,
  NumberFieldTrailing,
  NumberFieldMenu,
  useNumberField
} from '#vue/primitives/NumberField'
export type {
  NumberFieldActions,
  NumberFieldContext,
  NumberFieldEditPolicy,
  NumberFieldMutationSource,
  NumberFieldRootAttrs,
  NumberFieldRootEmits,
  NumberFieldRootProps,
  NumberFieldRootSlots,
  NumberFieldSlotProps,
  NumberFieldState,
  NumberFieldStateAttrs,
  NumberFieldValueSlots
} from '#vue/primitives/NumberField'
export {
  clampNumberValue,
  evaluateNumberExpression,
  normalizeNumberValue,
  stepNumberValue
} from '#vue/controls/number-expression'
export type {
  NumberExpressionError,
  NumberExpressionOptions,
  NumberExpressionResult
} from '#vue/controls/number-expression'
export { TypographyControlsRoot } from '#vue/primitives/TypographyControls'
export { ToolbarRoot, ToolbarItem, useToolbar } from '#vue/primitives/Toolbar'
export type { ToolbarContext } from '#vue/primitives/Toolbar'

/** DOM event helpers for cast-free template bindings. */
export { blurTarget, inputNumberValue, inputValue, selectTarget } from '#vue/shared/dom-events'

/** Internationalization. */
export {
  useI18n,
  useI18nNamespace,
  useMenuMessages,
  useCommandMessages,
  useToolMessages,
  usePanelMessages,
  useVariableTypeMessages,
  usePageMessages,
  useDialogMessages,
  i18n
} from '#vue/i18n'
export {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  TRANSLATED_LOCALES,
  LOCALE_DIR_NAMES,
  LOCALE_LABELS
} from '#vue/i18n'
export type { Locale, TranslatedLocale } from '#vue/i18n'
export {
  menuMessages,
  commandMessages,
  toolMessages,
  panelMessages,
  variableTypeMessages,
  pageMessages,
  dialogMessages,
  messageDefaults
} from '#vue/i18n'

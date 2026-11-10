export {
  assertNodeEditable,
  getNodeEditCapability,
  ReadOnlyLibraryDefinitionError
} from './capabilities'
export type { NodeEditCapability } from './capabilities'
export {
  FixedLayersError,
  MoveOnlyLayersError,
  ReadOnlyDocumentError,
  RefusedEditError
} from './read-only'
export { DEFAULT_SNAPPING_PREFERENCES } from './preferences'
export type { SnappingPreferences } from './preferences'
export { createDocumentGraph } from './document-settings'
export { gridNudge } from './nudge'
export { figJamColoredLayers, figJamToolbarKind, type FigJamToolbarKind } from './figjam/toolbar'
export { createDefaultEditorSharedState } from './state/shared'
export { editedGradient, editedGradientLayout } from './gradient-edit'
export {
  blurRampHandleAt,
  BLUR_RAMP_HANDLE,
  editedBlurRamp,
  editedBlurRampLayout,
  type BlurRampHandle,
  type BlurRampLayout
} from './blur-ramp-edit'
export type { SelectionSpacing } from './alignment'
export type { MovePlace } from './undo'
export type { AttachModifiers } from './connectors/attach'
export {
  replaceSelectionColor,
  selectionColors,
  selectionColorsShown,
  type SelectionColor
} from './selection/colors'
export {
  copyEditorViewState,
  createDefaultEditorViewState,
  pickEditorViewState
} from './state/view'
export { createDefaultEditorState, createEditor } from './create'
export { DEFAULT_VIEWPORT_CHROME, type ViewportInsets } from './viewport'
export { executeAtomicTool, type AtomicToolOptions } from './history/atomic-tool'
export { isEmptyDocumentChange, type DocumentChange } from './history/document-change'
export type { RecordEditOptions } from './history/edit'
export type { PageSnapshot } from './history/snapshot/page'
export { graphFromDocumentChange, graphFromPageSnapshot } from './history/snapshot/graph'
export type { ClipboardPayload, ClipboardSnapshot, CopyOptions } from './clipboard/copy'
export type { PastedTextLink } from './clipboard/web'
export { pastedPropertyChanges } from './clipboard/paste/properties'
export { resolvePasteTarget } from './clipboard/paste/target'
export { playIslandRoots } from './play/islands'
export { resolvePlayState, type InstanceState } from './play/states'
export { EDIT_VIEW, NO_HOST_RESTRICTIONS, resolveEditorProfile } from './views'
export type {
  CanvasView,
  EditorProfile,
  EditorProfileInputs,
  EditorRestrictions,
  LayerEdits,
  PathEdits
} from './views'
export type { ShaderRasterizer } from './shaders/types'
export { editsHandlesOnly } from './vector/limits'
export type { NodeEditExitOptions, NodeEditOptions, NodeEditState } from './vector/types'
export type { PenPress, PenPressEvent, PenPressKind, PenReleaseEvent } from './shapes/pen/gesture'
export type { DecidedMove, MoveChange, MovePolicy } from './move-policy'
export type { ShaderPaintList } from './shaders/actions'
export type { Editor } from './create'
export type {
  PageSwitchProgress,
  PreparedPage,
  PreparePageOptions,
  SwitchPageOptions
} from './pages'
export type { ExposableComponentField } from './components/authoring/context'
export type { VariableTokenFields } from './variables/actions'
export { reapplyInstanceComponentProperties } from './components/properties'
export { createGuideActions } from './guides'
export { createTextActions } from './text'
export { resizedPathTextGlyphs } from './text/path-edit'
export { opacityFromBuffer } from './nodes/actions'
export { layerTypeOptions, type LayerType } from './structure/layer-type'
export type { NodePreview } from './nodes/preview'
export { BOARD_TOOL_SHORTCUTS, BOARD_TOOLS, EDITOR_TOOLS, TOOL_SHORTCUTS } from './tool-registry'
export {
  applySampledColor,
  eyedropperChanges,
  sampleSceneColor,
  sampleScenePixels,
  scenePixelColor
} from './eyedropper'
export type { EyedropperTarget, ScenePixels } from './eyedropper'
export type { RenameSelectionOptions, RenameSelectionPreview } from './structure/rename'
export type { EditorToolDef } from './tool-registry'
export type {
  VariantConflict,
  VariantMutationResult,
  VariantValidationIssue
} from './components/variants'
export type {
  ClipboardImageResolution,
  EditorContext,
  EditorEventName,
  EditorEvents,
  RenderVersions,
  EditorOptions,
  EditorState,
  EditorSharedState,
  EditorViewState,
  FigmaClipboardImageResolver,
  ResumedPath,
  ShapeHandleHover,
  BlurRampEdit,
  GradientEdit,
  Tool
} from './types'

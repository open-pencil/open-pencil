export {
  assertNodeEditable,
  getNodeEditCapability,
  ReadOnlyLibraryDefinitionError
} from './capabilities'
export type { NodeEditCapability } from './capabilities'
export { ReadOnlyDocumentError } from './read-only'
export { DEFAULT_SNAPPING_PREFERENCES } from './preferences'
export type { SnappingPreferences } from './preferences'
export { createDocumentGraph } from './document-settings'
export { gridNudge } from './nudge'
export { figJamToolbarKind, type FigJamToolbarKind } from './figjam/toolbar'
export { createDefaultEditorSharedState } from './state/shared'
export { editedGradient, editedGradientLayout } from './gradient-edit'
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
export { executeAtomicTool } from './history/atomic-tool'
export { isEmptyDocumentChange, type DocumentChange } from './history/document-change'
export type { RecordEditOptions } from './history/edit'
export type { PageSnapshot } from './history/snapshot/page'
export { graphFromDocumentChange, graphFromPageSnapshot } from './history/snapshot/graph'
export type { ClipboardPayload, ClipboardSnapshot, CopyOptions } from './clipboard/copy'
export { pastedPropertyChanges } from './clipboard/paste/properties'
export { resolvePasteTarget } from './clipboard/paste/target'
export { playIslandRoots } from './play/islands'
export { resolvePlayState, type InstanceState } from './play/states'
export { EDIT_VIEW, resolveEditorProfile } from './views'
export type { CanvasView, EditorProfile, EditorProfileInputs, EditorRestrictions } from './views'
export type { ShaderRasterizer } from './shaders/types'
export type { ShaderPaintList } from './shaders/actions'
export type { Editor } from './create'
export type {
  PageSwitchProgress,
  PreparedPage,
  PreparePageOptions,
  SwitchPageOptions
} from './pages'
export type { ExposableComponentField } from './components/authoring/context'
export type { VariableTokenFields } from './variables'
export { reapplyInstanceComponentProperties } from './components/properties'
export { createGuideActions } from './guides'
export { createTextActions } from './text'
export { resizedPathTextGlyphs } from './text/path-edit'
export { opacityFromBuffer } from './nodes'
export { layerTypeOptions, type LayerType } from './structure/layer-type'
export type { NodePreview } from './node-preview'
export { BOARD_TOOL_SHORTCUTS, BOARD_TOOLS, EDITOR_TOOLS, TOOL_SHORTCUTS } from './tool-registry'
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
  EditorOptions,
  EditorState,
  EditorSharedState,
  EditorViewState,
  FigmaClipboardImageResolver,
  ResumedPath,
  ShapeHandleHover,
  GradientEdit,
  Tool
} from './types'

export {
  assertNodeEditable,
  getNodeEditCapability,
  ReadOnlyLibraryDefinitionError
} from './capabilities'
export type { NodeEditCapability } from './capabilities'
export { DEFAULT_SNAPPING_PREFERENCES } from './preferences'
export type { SnappingPreferences } from './preferences'
export { createDefaultEditorSharedState } from './state/shared'
export { editedGradient, editedGradientLayout } from './gradient-edit'
export type { SelectionSpacing } from './alignment'
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
export type { PageChange } from './history/page-change'
export { isEmptyPageChange } from './history/page-change'
export type { PageSnapshot } from './history/snapshot'
export { graphFromPageChange, graphFromPageSnapshot } from './history/snapshot-graph'
export type { ClipboardPayload, ClipboardSnapshot } from './clipboard/copy'
export { resolvePasteTarget } from './clipboard/paste-target'
export { playIslandRoots } from './play/islands'
export { resolvePlayState, type InstanceState } from './play/states'
export type { PlayState } from './play/actions'
export type { Editor } from './create'
export type { VariableTokenFields } from './variables'
export type { TokenImportResult } from '#core/io/formats/design-tokens'
export { reapplyInstanceComponentProperties } from './components/properties'
export { createGuideActions } from './guides'
export { createTextActions } from './text'
export { opacityFromBuffer } from './nodes'
export type { NodePreview } from './node-preview'
export { EDITOR_TOOLS, TOOL_SHORTCUTS } from './tool-registry'
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
  CornerRadiusHover,
  GradientEdit,
  Tool
} from './types'

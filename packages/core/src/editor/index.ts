export {
  assertNodeEditable,
  getNodeEditCapability,
  ReadOnlyLibraryDefinitionError
} from './capabilities'
export type { NodeEditCapability } from './capabilities'
export { createDefaultEditorSharedState } from './state/shared'
export {
  copyEditorViewState,
  createDefaultEditorViewState,
  pickEditorViewState
} from './state/view'
export { createDefaultEditorState, createEditor } from './create'
export type { Editor } from './create'
export { reapplyInstanceComponentProperties } from './components/properties'
export { createTextActions } from './text'
export { opacityFromBuffer } from './nodes'
export { EDITOR_TOOLS, TOOL_SHORTCUTS } from './tool-registry'
export type { RenameSelectionOptions, RenameSelectionPreview } from './structure/rename'
export type { EditorToolDef } from './tool-registry'
export type { VariantConflict, VariantValidationIssue } from './components/variants'
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
  Tool
} from './types'

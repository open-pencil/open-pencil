import type { EditorProfileInputs } from '#core/editor/views'
import { resolveEditorProfile } from '#core/editor/views'

/**
 * Whether only a path's handles may change: its points keep their places and connections, so
 * nothing adds, removes, moves, joins, breaks, or aligns them, and the pen does not continue it.
 */
export function editsHandlesOnly(state: EditorProfileInputs): boolean {
  return resolveEditorProfile(state).pathEdits === 'handles'
}

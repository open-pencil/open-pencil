import {
  generatedFrameKind,
  generatedFrameOwner,
  generatedFrameText
} from '@open-pencil/scene-graph/generated'

import { defaultNodeName } from '#core/editor/structure/rename'
import type { EditorContext } from '#core/editor/types'

/**
 * Typing in the text a generated frame is named by, such as a sticky note's body or a shape's
 * label, renames a frame that was never renamed, as FigJam does; emptied, it takes its type's
 * name back. The caller records the text edit; this records the rename beside it.
 */
export function applyGeneratedTextNameEdit(
  ctx: Pick<EditorContext, 'graph' | 'undo'>,
  nodeId: string,
  text: string
): void {
  const node = ctx.graph.getNode(nodeId)
  const frame = node && generatedFrameOwner(ctx.graph, node)
  if (!frame?.autoRename || !generatedFrameKind(frame)?.namedByText) return
  if (generatedFrameText(ctx.graph, frame)?.id !== nodeId) return
  const before = frame.name
  const after = text.trim() === '' ? defaultNodeName(frame.type) : text
  if (before === after) return
  const rename = (name: string) => () => ctx.graph.updateNode(frame.id, { name })
  rename(after)()
  ctx.undo.push({ label: 'Rename', forward: rename(after), inverse: rename(before) })
}

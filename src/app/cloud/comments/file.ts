import type { CloudCommentThread } from '@open-pencil/cloud/contract'
import { writeComments } from '@open-pencil/scene-graph/comments'

import { documentThread } from './threads'

/**
 * A stored Cloud file with the document's comments written back into it, as the editor's Save As
 * writes them, so a file taken out of Cloud keeps them. Core loads only when there are some; the
 * write patches the document record and leaves the rest of the archive as it was.
 */
export async function withCloudComments(
  bytes: Uint8Array,
  threads: readonly CloudCommentThread[]
): Promise<Uint8Array> {
  if (threads.length === 0) return bytes
  const { exportFigFile, parseFigFile } = await import('@open-pencil/core/io/formats/fig')
  const graph = await parseFigFile(Uint8Array.from(bytes).buffer)
  writeComments(graph, threads.map(documentThread))
  return exportFigFile(graph)
}

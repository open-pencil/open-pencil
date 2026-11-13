import type { SceneGraph } from '@open-pencil/scene-graph'

import { readFigDocument } from '@/app/document/io/fig'

/** A `.fig` file named after its document, holding a copy of the bytes. */
export function figFile(bytes: Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy.buffer], `${name}.fig`, { type: 'application/octet-stream' })
}

/**
 * Reads a `.fig` file's bytes as a tab opens them, for an editor of its own such as an earlier
 * version's preview. The page it shows prepares its own fonts and layout.
 */
export function readFigBytes(
  bytes: Uint8Array,
  name: string,
  signal?: AbortSignal
): Promise<SceneGraph> {
  return readFigDocument(figFile(bytes, name), signal)
}

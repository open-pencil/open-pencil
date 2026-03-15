import { parseFigFile, readFigFile } from './kiwi/fig-file'
import { parsePenFile, readPenFile } from './pen-file'

import type { SceneGraph } from './scene-graph'

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot !== -1 ? name.slice(dot).toLowerCase() : ''
}

export async function readDesignFile(file: File): Promise<SceneGraph> {
  const ext = getExtension(file.name)
  if (ext === '.pen') return readPenFile(file)
  return readFigFile(file)
}

export async function parseDesignFile(
  data: ArrayBuffer | string,
  filename: string
): Promise<SceneGraph> {
  const ext = getExtension(filename)
  if (ext === '.pen') {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
    return parsePenFile(text)
  }
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data
  return parseFigFile(buffer)
}

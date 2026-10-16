import { readFigFile } from '@open-pencil/core/io/formats/fig'

import { rememberLoadedRevision } from '@/app/document/io/revision'

export async function readFigDocument(file: File, signal?: AbortSignal) {
  const graph = await readFigFile(file, {
    populate: 'first-page',
    signal
  })
  rememberLoadedRevision(graph, file)
  return graph
}

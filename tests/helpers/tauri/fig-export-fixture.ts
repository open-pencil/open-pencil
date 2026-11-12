import { unzipSync } from 'fflate'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { installNativeFigArchives } from '@/app/document/io/native-fig'

import { mockTauriIPC } from './mocks'

const CANVAS = new Uint8Array([7, 8, 9])

await mockTauriIPC((cmd, body, options) => {
  if (cmd !== 'compress_fig_canvas') throw new Error(`Unexpected command: ${cmd}`)
  if (!(body instanceof Uint8Array)) throw new Error('the document data is not a raw body')
  const headers = new Headers(
    (options as { headers?: Record<string, string> } | undefined)?.headers
  )
  const schemaLength = Number(headers.get('x-fig-schema-length'))
  if (!(schemaLength > 0 && schemaLength < body.byteLength)) {
    throw new Error(
      `x-fig-schema-length ${schemaLength} does not split a ${body.byteLength} byte body`
    )
  }
  if (headers.get('x-fig-board') !== 'false') throw new Error('a new design is no board')
  return CANVAS.buffer
})

installNativeFigArchives()
const entries = unzipSync(await exportFigFile(new SceneGraph()))
if (entries['canvas.fig']?.join(',') !== CANVAS.join(',')) {
  throw new Error(`canvas.fig is not what the host compressed: ${entries['canvas.fig']?.join(',')}`)
}
if (!entries['thumbnail.png']?.length || !entries['meta.json']?.length) {
  throw new Error('the archive around the host-compressed document is incomplete')
}

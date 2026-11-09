import { unzipSync } from 'fflate'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { installNativeFigArchives } from '@/app/document/io/native-fig'

import { mockTauriIPC } from './mocks'

const canvas = new Uint8Array([7, 8, 9])

await mockTauriIPC((cmd, args, options) => {
  if (cmd !== 'compress_fig_canvas') throw new Error(`Unexpected command: ${cmd}`)
  if (!(args instanceof Uint8Array)) throw new Error('Expected a raw request body')
  if (args.byteLength === 0) throw new Error('The request body is empty')
  const headers = (options as { headers?: Record<string, string> } | undefined)?.headers
  const schemaLength = Number(headers?.['x-fig-schema-length'])
  if (!Number.isFinite(schemaLength) || schemaLength <= 0) {
    throw new Error('Missing x-fig-schema-length')
  }
  if (schemaLength >= args.byteLength) throw new Error('The schema length leaves no document data')
  if (headers?.['x-fig-board'] !== '0') throw new Error('a new design is no board')
  return canvas.buffer
})

installNativeFigArchives()
const bytes = await exportFigFile(new SceneGraph())
const entries = unzipSync(bytes)
if (!entries['canvas.fig']) throw new Error('The archive has no canvas.fig')
if (entries['canvas.fig'].some((byte, index) => byte !== canvas[index])) {
  throw new Error(`Unexpected canvas bytes: ${Array.from(entries['canvas.fig']).join(',')}`)
}

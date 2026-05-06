import { mockIPC } from '@tauri-apps/api/mocks'

const windowLike = globalThis as typeof globalThis & {
  __TAURI_INTERNALS__?: unknown
  __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown
}
Object.assign(globalThis, { window: windowLike })

mockIPC((cmd, args) => {
  if (cmd !== 'build_fig_file') throw new Error(`Unexpected command: ${cmd}`)
  const payload = args as {
    schemaDeflated: number[]
    kiwiData: number[]
    thumbnailPng: number[]
    metaJson: string
    images: Array<{ name: string; data: number[] }>
  }
  if (payload.schemaDeflated.length === 0) throw new Error('schemaDeflated is empty')
  if (payload.kiwiData.length === 0) throw new Error('kiwiData is empty')
  if (payload.thumbnailPng.length === 0) throw new Error('thumbnailPng is empty')
  if (payload.images.length !== 0) throw new Error('images should be empty')
  JSON.parse(payload.metaJson)
  return [7, 8, 9]
})

const [{ exportFigFile }, { SceneGraph }] = await Promise.all([
  import('@open-pencil/core/io/formats/fig/export'),
  import('@open-pencil/core/scene-graph')
])
const bytes = await exportFigFile(new SceneGraph())
if (bytes.length !== 3 || bytes[0] !== 7 || bytes[1] !== 8 || bytes[2] !== 9) {
  throw new Error(`Unexpected export bytes: ${Array.from(bytes).join(',')}`)
}

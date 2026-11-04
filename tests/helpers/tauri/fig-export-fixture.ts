import { mockIPC } from '@tauri-apps/api/mocks'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { installNativeFigArchives } from '@/app/document/io/native-fig'

import { installTauriMockWindow } from './mocks'

installTauriMockWindow()

mockIPC((cmd, args) => {
  if (cmd !== 'build_fig_file') throw new Error(`Unexpected command: ${cmd}`)
  const { file: payload } = args as {
    file: {
      schemaDeflated: number[]
      kiwiData: number[]
      thumbnailPng: number[]
      metaJson: string
      images: Array<{ name: string; data: number[] }>
      board: boolean
    }
  }
  if (payload.board) throw new Error('a new design is no board')
  if (payload.schemaDeflated.length === 0) throw new Error('schemaDeflated is empty')
  if (payload.kiwiData.length === 0) throw new Error('kiwiData is empty')
  if (payload.thumbnailPng.length === 0) throw new Error('thumbnailPng is empty')
  if (payload.images.length !== 0) throw new Error('images should be empty')
  JSON.parse(payload.metaJson)
  return new Uint8Array([7, 8, 9]).buffer
})

installNativeFigArchives()
const bytes = await exportFigFile(new SceneGraph())
if (bytes.length !== 3 || bytes[0] !== 7 || bytes[1] !== 8 || bytes[2] !== 9) {
  throw new Error(`Unexpected export bytes: ${Array.from(bytes).join(',')}`)
}

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { fontManager } from '@open-pencil/core/text'
import { repoPath } from '@open-pencil/test-support/paths'

const cleanups: (() => void)[] = []

/**
 * Disposes the editors and renderers made since the last call. A renderer installs the shared
 * layout text measurer until its editor is disposed; left installed, it measures text in later
 * files without their fonts. Each file calls this in its own `afterEach`: a hook registered here
 * would run only for the first file to import the module.
 */
export function disposeFlattenEditors() {
  for (const cleanup of cleanups.splice(0)) cleanup()
}

export async function createEditorWithRenderer() {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  cleanups.push(() => {
    editor.dispose()
    renderer.destroy()
  })
  return { editor, renderer }
}

export async function loadInterRegular() {
  const data = await Bun.file(repoPath('packages/core/assets/InterVariable.ttf')).arrayBuffer()
  await fontManager.markLoaded('Inter', 'Regular', data)
}

export async function loadInterBold() {
  const data = await Bun.file(repoPath('packages/core/assets/InterVariable.ttf')).arrayBuffer()
  await fontManager.markLoaded('Inter', 'Bold', data)
}

export async function loadNotoSansSC() {
  const file = Bun.file(repoPath('tests/fixtures/fonts/NotoSansSC-Regular.ttf'))
  const text = await file.slice(0, 32).text()
  if (text.startsWith('version ')) return false
  const data = await file.arrayBuffer()
  await fontManager.markLoaded('Noto Sans SC', 'Regular', data)
  fontManager.setCJKFallbackFamily('Noto Sans SC')
  return true
}

import { describe, expect, test } from 'bun:test'

import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import {
  provideShaderFrames,
  useShaderFrames,
  type ShaderFrames
} from '#vue/canvas/surface/shader/frames'

const IMAGE = 'image-hash'
const FRAME = { width: 1, height: 1 } as unknown as CanvasImageSource

/**
 * Two canvases of one editor, each with an island over it, and an island beside them that no
 * canvas holds, as an SDK app placing `PlayIslands` beside `CanvasRoot` would mount it.
 */
async function mountCanvases() {
  const editor = createEditor({ graph: new SceneGraph() })
  const canvases: ShaderFrames[] = []
  const received: Record<string, number> = {}
  const island = (name: string) =>
    defineComponent({
      setup() {
        received[name] = 0
        useShaderFrames(editor).listen(IMAGE, () => received[name]++)
        return () => null
      }
    })
  const canvas = (name: string) =>
    defineComponent({
      setup() {
        canvases.push(provideShaderFrames(editor))
        return () => h(island(name))
      }
    })
  const app = createSSRApp({
    render: () => [h(canvas('left')), h(canvas('right')), h(island('beside'))]
  })
  await renderToString(app)
  return { canvases, received }
}

describe('shader frames', () => {
  test('an island over a canvas draws only that canvas’s frames', async () => {
    const { canvases, received } = await mountCanvases()
    canvases[0].publish(IMAGE, FRAME)
    expect(received).toEqual({ left: 1, right: 0, beside: 1 })
  })

  test('an island outside any canvas draws every canvas’s frames', async () => {
    const { canvases, received } = await mountCanvases()
    canvases[0].publish(IMAGE, FRAME)
    canvases[1].publish(IMAGE, FRAME)
    expect(received.beside).toBe(2)
  })
})

import { expect, test } from 'bun:test'

import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

test('scripts set layout and text direction through openpencil, which figma lacks', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const result = (await compileScript(`
    const frame = figma.createFrame()
    const text = figma.createText()
    const before = openpencil.getLayoutDirection(frame)
    openpencil.setLayoutDirection(frame, 'RTL')
    openpencil.setTextDirection(text, 'RTL')
    return {
      before,
      layout: openpencil.getLayoutDirection(frame),
      text: openpencil.getTextDirection(text),
      onFigma: 'layoutDirection' in frame || 'textDirection' in text
    }
  `)(figma)) as { before: string; layout: string; text: string; onFigma: boolean }
  expect(result).toEqual({ before: 'AUTO', layout: 'RTL', text: 'RTL', onFigma: false })
  await expect(
    compileScript(`openpencil.setTextDirection(figma.createText(), 'UP')`)(figma)
  ).rejects.toThrow('Unknown direction UP; use AUTO, LTR, RTL')
})

test('a layer saved without a layout direction reads AUTO', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  Reflect.deleteProperty(graph.getNode(frame.id) as object, 'layoutDirection')
  expect(new OpenPencilAPI(figma).getLayoutDirection(frame)).toBe('AUTO')
})

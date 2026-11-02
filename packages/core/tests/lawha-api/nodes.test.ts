import { expect, test } from 'bun:test'

import { LawhaAPI } from '@lawha/core/lawha-api'
import { FigmaAPI } from '@lawha/core/figma-api'
import { compileScript } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

test('scripts set layout and text direction through lawha, which figma lacks', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const result = (await compileScript(`
    const frame = figma.createFrame()
    const text = figma.createText()
    const before = lawha.getLayoutDirection(frame)
    lawha.setLayoutDirection(frame, 'RTL')
    lawha.setTextDirection(text, 'RTL')
    return {
      before,
      layout: lawha.getLayoutDirection(frame),
      text: lawha.getTextDirection(text),
      onFigma: 'layoutDirection' in frame || 'textDirection' in text
    }
  `)(figma)) as { before: string; layout: string; text: string; onFigma: boolean }
  expect(result).toEqual({ before: 'AUTO', layout: 'RTL', text: 'RTL', onFigma: false })
  await expect(
    compileScript(`lawha.setTextDirection(figma.createText(), 'UP')`)(figma)
  ).rejects.toThrow('Unknown direction UP; use AUTO, LTR, RTL')
})

test('a layer saved without a layout direction reads AUTO', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  Reflect.deleteProperty(graph.getNode(frame.id) as object, 'layoutDirection')
  expect(new LawhaAPI(figma).getLayoutDirection(frame)).toBe('AUTO')
})

/** What the Markdown script reads back from the text it wrote. */
interface MarkdownResult {
  text: string
  heading: number
  size: number | 'mixed'
  bold: unknown
}

test('scripts write Markdown into a text through lawha, once its fonts are loaded', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const result = (await compileScript(`
    const text = figma.createText()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
    lawha.setTextMarkdown(text, '# Hi\\n**there** and here')
    return {
      text: text.characters,
      heading: text.getRangeFontSize(0, 1),
      size: text.fontSize === figma.mixed ? 'mixed' : text.fontSize,
      bold: text.getRangeFontName(3, 4)
    }
  `)(figma)) as MarkdownResult
  expect(result).toMatchObject({
    text: 'Hi\nthere and here',
    heading: 30,
    size: 'mixed',
    bold: { family: 'Inter', style: 'Bold' }
  })
  await expect(
    compileScript(`lawha.setTextMarkdown(figma.createText(), 'a \`b\`')`)(figma)
  ).rejects.toThrow('unloaded font "Roboto Mono Medium"')
  await expect(compileScript(`lawha.setTextMarkdown(figma.createFrame(), 'a')`)(figma)).rejects.toThrow(
    'Markdown is written into a text layer, not FRAME'
  )
})

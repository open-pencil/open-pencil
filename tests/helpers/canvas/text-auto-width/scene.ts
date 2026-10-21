import type { SceneGraph } from '@open-pencil/scene-graph'

const TEXT = 'Acme quarterly overview'
const MAX_WIDTH = 120
const LINE_HEIGHT = 24

const TRUNCATED = [
  { y: 40, textAlignHorizontal: 'LEFT' },
  { y: 100, textAlignHorizontal: 'CENTER' },
  { y: 160, textAlignHorizontal: 'RIGHT' }
] as const

const BOX_FILL = {
  type: 'SOLID' as const,
  color: { r: 0.86, g: 0.91, b: 0.98, a: 1 },
  opacity: 1,
  visible: true
}

const AUTO_WIDTH_TEXT = {
  x: 40,
  width: MAX_WIDTH,
  height: LINE_HEIGHT,
  text: TEXT,
  fontFamily: 'Inter',
  fontSize: 20,
  textAutoResize: 'WIDTH_AND_HEIGHT',
  textTruncation: 'ENDING',
  maxLines: 1
} as const

export function createTextAutoWidthScene(graph: SceneGraph, pageId: string): void {
  for (const { y, textAlignHorizontal } of TRUNCATED) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Max width box ${textAlignHorizontal}`,
      x: 40,
      y,
      width: MAX_WIDTH,
      height: LINE_HEIGHT,
      fills: [BOX_FILL]
    })
    graph.createNode('TEXT', pageId, {
      ...AUTO_WIDTH_TEXT,
      name: `Truncated ${textAlignHorizontal}`,
      y,
      textAlignHorizontal,
      maxWidth: MAX_WIDTH
    })
  }
  graph.createNode('TEXT', pageId, {
    ...AUTO_WIDTH_TEXT,
    name: 'Without a max width',
    y: 220
  })
}

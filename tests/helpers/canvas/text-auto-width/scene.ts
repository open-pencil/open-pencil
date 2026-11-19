import type { SceneGraph } from '@open-pencil/scene-graph'

const TEXT = 'Acme quarterly overview'
const MAX_WIDTH = 120

const ROWS = [
  { y: 40, textAlignHorizontal: 'LEFT', maxWidth: MAX_WIDTH },
  { y: 100, textAlignHorizontal: 'CENTER', maxWidth: MAX_WIDTH },
  { y: 160, textAlignHorizontal: 'RIGHT', maxWidth: MAX_WIDTH },
  { y: 220, textAlignHorizontal: 'LEFT', maxWidth: null }
] as const

const BOX_FILL = {
  type: 'SOLID' as const,
  color: { r: 0.86, g: 0.91, b: 0.98, a: 1 },
  opacity: 1,
  visible: true
}

/**
 * Auto-width text that truncates, each in an auto layout frame that hugs it: Figma takes a max
 * width only on auto layout layers and their children. The frames' fill shows the boxes.
 */
export function createTextAutoWidthScene(graph: SceneGraph, pageId: string): void {
  for (const { y, textAlignHorizontal, maxWidth } of ROWS) {
    const frame = graph.createNode('FRAME', pageId, {
      name: maxWidth ? `Max width ${textAlignHorizontal}` : 'Without a max width',
      x: 40,
      y,
      width: MAX_WIDTH,
      height: 24,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      fills: [BOX_FILL]
    })
    graph.createNode('TEXT', frame.id, {
      name: maxWidth ? `Truncated ${textAlignHorizontal}` : 'Without a max width',
      text: TEXT,
      fontFamily: 'Inter',
      fontSize: 20,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      textTruncation: 'ENDING',
      maxLines: 1,
      textAlignHorizontal,
      maxWidth
    })
  }
}

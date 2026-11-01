import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('<Text markdown>', () => {
  test('reads its text as Markdown over the text’s own style, its shared indent left out', async () => {
    const graph = new SceneGraph()
    const [text] = await renderJSX(
      graph,
      `<Text markdown size={20}>{\`
        ## Plan
        - **ship** it
      \`}</Text>`
    )
    const node = getNodeOrThrow(graph, text.id)
    expect(node.text).toBe('Plan\nship it')
    expect(node.fontSize).toBe(20)
    expect(node.textParagraphs).toEqual([
      { listType: 'NONE', indentation: 0 },
      { listType: 'UNORDERED', indentation: 1 }
    ])
    expect(node.styleRuns).toEqual([
      {
        start: 0,
        length: 5,
        style: { fontWeight: 700, fontSize: 30, lineHeight: { unit: 'PERCENT', value: 150 } }
      },
      { start: 5, length: 4, style: { fontWeight: 700 } }
    ])
  })

  test('keeps a nested list item’s indent beyond the indent its lines share', async () => {
    for (const indent of ['', '    ']) {
      const graph = new SceneGraph()
      const source = ['- one', '  - inner'].map((line) => indent + line).join('\n')
      const [text] = await renderJSX(graph, `<Text markdown>{\`\n${source}\n\`}</Text>`)
      expect(getNodeOrThrow(graph, text.id).textParagraphs).toEqual([
        { listType: 'UNORDERED', indentation: 1 },
        { listType: 'UNORDERED', indentation: 2 }
      ])
    }
  })

  test('takes its Markdown from the text prop too', async () => {
    const graph = new SceneGraph()
    const [text] = await renderJSX(graph, `<Text markdown text="a *b*" />`)
    expect(getNodeOrThrow(graph, text.id).styleRuns).toEqual([
      { start: 2, length: 1, style: { italic: true } }
    ])
  })

  test('holds no <Span>', async () => {
    await expect(
      renderJSX(new SceneGraph(), '<Text markdown>a <Span weight={700}>b</Span></Text>')
    ).rejects.toThrow('<Text markdown> holds only its Markdown text')
  })
})

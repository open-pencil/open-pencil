import { describe, expect, test } from 'bun:test'

import { serializeHTML } from '#dom-css/export/html'
import { sceneNodeToDesignDocument } from '#dom-css/export/projection'
import {
  sceneNodesToTailwindJSX,
  sceneNodesToTailwindJSXWithLayers
} from '#dom-css/export/tailwind-jsx'

import { SceneGraph, type Fill, type TextParagraphStyle } from '@open-pencil/scene-graph'

const RED: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}
/** A link that runs script, which no export may write. */
const SCRIPT_SCHEME = ['java', 'script:'].join('')
const PLAIN: TextParagraphStyle = { listType: 'NONE', indentation: 0 }

function text(props: Parameters<SceneGraph['createNode']>[2]) {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 16,
    width: 200,
    height: 40,
    ...props
  })
  const html = serializeHTML(sceneNodeToDesignDocument(graph, node.id, { includeSourceIds: false }))
  return { graph, node, html }
}

describe('text export', () => {
  test('writes runs as spans that set only what differs from the text', () => {
    const { html } = text({
      text: 'Hello world',
      styleRuns: [
        { start: 0, length: 5, style: { fontWeight: 700 } },
        { start: 6, length: 5, style: { fills: [RED], fontSize: 24 } }
      ]
    })
    expect(html).toContain(
      '<span style="font-weight: 700">Hello</span> <span style="color: #FF0000; font-size: 24px">world</span>'
    )
  })

  test('decorates the text when every character is decorated alike, with all its details', () => {
    const { html } = text({
      text: 'Linked',
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationFills: [RED],
      textDecorationThickness: 2,
      textUnderlineOffset: 4,
      textDecorationSkipInk: false
    })
    expect(html).toContain(
      'text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #FF0000; ' +
        'text-decoration-thickness: 2px; text-underline-offset: 4px; text-decoration-skip-ink: none'
    )
    expect(html).not.toContain('<span style="text-decoration')
  })

  test('decorates spans when decorations differ, since CSS cannot take one off a descendant', () => {
    const { html } = text({
      text: 'on off',
      textDecoration: 'UNDERLINE',
      styleRuns: [{ start: 2, length: 4, style: { textDecoration: 'NONE' } }]
    })
    expect(html).toContain('<span style="text-decoration-line: underline">on</span> off')
  })

  test('writes lists as nested lists with Figma markers and the spacing after each paragraph', () => {
    const { html } = text({
      text: 'Intro\nOne\nNested\nTwo\nDot',
      paragraphSpacing: 12,
      listSpacing: 4,
      textParagraphs: [
        PLAIN,
        { listType: 'ORDERED', indentation: 1 },
        { listType: 'ORDERED', indentation: 2 },
        { listType: 'ORDERED', indentation: 1 },
        { listType: 'UNORDERED', indentation: 1 }
      ]
    })
    expect(html).toStartWith('<div ')
    expect(html).toContain('<p style="margin-top: 0px; margin-bottom: 12px">Intro</p>')
    expect(html).toContain(
      '<ol style="margin-top: 0px; margin-bottom: 0px; padding-inline-start: 24px; list-style-type: decimal"><li>One' +
        '<ol style="margin-top: 4px; margin-bottom: 0px; padding-inline-start: 24px; list-style-type: lower-alpha">' +
        '<li style="margin-bottom: 4px">Nested</li></ol></li><li style="margin-bottom: 4px">Two</li></ol>'
    )
    expect(html).toContain('list-style-type: disc"><li>Dot</li></ul>')
  })

  test('gives an empty paragraph a line break, and a first-line indent to plain paragraphs', () => {
    const { html } = text({ text: 'One\n\nTwo', paragraphIndent: 8 })
    expect(html).toContain('text-indent: 8px">One</p>')
    expect(html).toContain('text-indent: 8px"><br></p>')
  })

  test('keeps text without lists or spacing in one element', () => {
    const { html } = text({ text: 'One\nTwo' })
    expect(html).toStartWith('<span ')
    expect(html).toContain('>One\nTwo</span>')
  })

  test('writes Tailwind spans and blocks, and a div around blocks', () => {
    const { graph, node } = text({
      text: 'Bold\nItem',
      styleRuns: [{ start: 0, length: 4, style: { fontWeight: 700 } }],
      textParagraphs: [PLAIN, { listType: 'UNORDERED', indentation: 1 }]
    })
    const jsx = sceneNodesToTailwindJSX(graph, [node.id])
    expect(jsx).toStartWith('<div ')
    expect(jsx).toContain('<span className="font-bold">Bold</span>')
    expect(jsx).toContain('<ul className="mt-0 mb-0 ps-6 list-disc">')
  })

  test('lists spans and blocks as elements without a layer, for the Code tab to skip', () => {
    const { graph, node } = text({
      text: 'Bold\nItem',
      styleRuns: [{ start: 0, length: 4, style: { fontWeight: 700 } }],
      textParagraphs: [PLAIN, { listType: 'UNORDERED', indentation: 1 }]
    })
    const { code, layerIds } = sceneNodesToTailwindJSXWithLayers(graph, [node.id])
    // The text, its paragraph and span, then the list and its item.
    expect(layerIds).toEqual([node.id, null, null, null, null])
    expect(code.match(/<(?!\/)[A-Za-z]/g)).toHaveLength(layerIds.length)
  })

  test('writes a range in its own case as text-transform', () => {
    const { html } = text({
      text: 'loud quiet',
      textCase: 'UPPER',
      styleRuns: [{ start: 5, length: 5, style: { textCase: 'ORIGINAL' } }]
    })
    expect(html).toContain('text-transform: uppercase')
    expect(html).toContain('loud <span style="text-transform: none">quiet</span>')
  })

  test('writes linked characters as a link in the look of the text around it', () => {
    const { graph, node, html } = text({
      text: 'Read the docs now',
      styleRuns: [
        {
          start: 9,
          length: 4,
          style: { hyperlink: { type: 'URL', value: 'https://openpencil.dev/docs' } }
        },
        {
          start: 14,
          length: 3,
          style: { hyperlink: { type: 'URL', value: `${SCRIPT_SCHEME}alert(1)` } }
        }
      ]
    })
    expect(html).toContain(
      'Read the <a href="https://openpencil.dev/docs" style="color: inherit; text-decoration-line: none">docs</a> now'
    )
    expect(html).not.toContain(SCRIPT_SCHEME)
    const jsx = sceneNodesToTailwindJSX(graph, [node.id])
    expect(jsx).toContain(
      '<a href="https://openpencil.dev/docs" className="text-inherit no-underline">docs</a>'
    )
  })
})

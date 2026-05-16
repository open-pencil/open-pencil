import { describe, expect, test } from 'bun:test'

import { renderSVGNode, svg } from '@open-pencil/core'

// --- SVGNode builder tests ---

describe('svg() and renderSVGNode()', () => {
  test('self-closing element', () => {
    const node = svg('rect', { width: 100, height: 50 })
    expect(renderSVGNode(node)).toBe('<rect width="100" height="50"/>')
  })

  test('element with text child', () => {
    const node = svg('text', { x: 10 }, 'Hello')
    expect(renderSVGNode(node)).toBe('<text x="10">Hello</text>')
  })

  test('nested elements', () => {
    const node = svg('g', { id: 'group' }, svg('rect', { width: 10, height: 10 }))
    const result = renderSVGNode(node)
    expect(result).toContain('<g id="group">')
    expect(result).toContain('  <rect width="10" height="10"/>')
    expect(result).toContain('</g>')
  })

  test('filters null/undefined attrs', () => {
    const node = svg('rect', { width: 100, fill: undefined, stroke: null })
    expect(renderSVGNode(node)).toBe('<rect width="100"/>')
  })

  test('filters null/undefined/false children', () => {
    const node = svg('g', {}, null, false, svg('rect', {}), undefined)
    const result = renderSVGNode(node)
    expect(result).toContain('<rect/>')
  })

  test('escapes attribute values', () => {
    const node = svg('text', { 'data-info': 'a"b<c' })
    expect(renderSVGNode(node)).toContain('data-info="a&quot;b&lt;c"')
  })

  test('escapes text content', () => {
    const node = svg('text', {}, '1 < 2 & 3 > 0')
    expect(renderSVGNode(node)).toBe('<text>1 &lt; 2 &amp; 3 &gt; 0</text>')
  })
})

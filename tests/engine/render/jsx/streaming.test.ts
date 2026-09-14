import { describe, expect, it } from 'bun:test'

import {
  buildComponent,
  createElement,
  createStreamingJSXParser,
  resolveToTree,
  renderTree,
  type JSXPreviewNode,
  type TreeNode
} from '@open-pencil/core/design-jsx'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

function withoutPositions(tree: JSXPreviewNode | null): TreeNode | null {
  if (!tree) return null
  return {
    type: tree.type,
    props: tree.props,
    children: tree.children.flatMap((child) => {
      if (typeof child === 'string') return [child]
      const result = withoutPositions(child)
      return result ? [result] : []
    })
  }
}

function preview(source: string) {
  return createStreamingJSXParser().append(source)
}

describe('streaming Design JSX', () => {
  it('projects open containers and growing text without closing tags', () => {
    const parser = createStreamingJSXParser()
    const first = parser.append('<Frame w={400} bg="#fff"><Text size={24}>Hello')
    expect(withoutPositions(first.tree)).toEqual({
      type: 'frame',
      props: { w: 400, bg: '#fff' },
      children: [{ type: 'text', props: { size: 24 }, children: ['Hello'] }]
    })
    const next = parser.append(' world</Text></Frame>')
    expect(next.tree?.sourceStart).toBe(first.tree?.sourceStart)
    expect(withoutPositions(first.tree)?.children).toEqual([
      { type: 'text', props: { size: 24 }, children: ['Hello'] }
    ])
    expect(next.pending).toEqual([])
  })

  it.each(['<', '<Frame', '<Frame w={', '<Frame bg="red', '<Frame w={20}', '<Frame /'])(
    'does not publish a recovered but incomplete opening: %s',
    (source) => {
      expect(preview(source).tree).toBeNull()
    }
  )

  it('keeps complete siblings while the next opening is incomplete', () => {
    const result = preview('<Frame><Text>Hello</Text><Rectangle w={20}')
    expect(withoutPositions(result.tree)?.children).toEqual([
      { type: 'text', props: {}, children: ['Hello'] }
    ])
    expect(result.pending.length).toBeGreaterThan(0)
  })

  it('never treats JSX inside a deferred JavaScript expression as children', () => {
    const result = preview(
      '<Frame>{items.map(x => <Text>{x.name}</Text>)}<Text>Static</Text></Frame>'
    )
    expect(withoutPositions(result.tree)?.children).toEqual([
      { type: 'text', props: {}, children: ['Static'] }
    ])
    expect(result.pending.some(({ reason }) => reason === 'unsupported')).toBe(true)
  })

  it('defers calls rather than executing them', () => {
    const result = preview(
      '<Frame w={(() => { throw new Error("executed") })()}><Text>Safe</Text></Frame>'
    )
    expect(result.tree?.props).toEqual({})
    expect(result.pending).toHaveLength(1)
  })

  it('defers an element with a spread', () => {
    expect(preview('<Frame {...props} />').tree).toBeNull()
  })

  const fixtures = [
    '<Frame w={400} bg="#fff"><Text size={24}>Hello</Text><Rect w={-20} visible /></Frame>',
    '<Text>Hello &amp; goodbye &#x1F600;</Text>',
    '<Text>{"hello\\nworld"}{42}{false}{null}</Text>',
    '<Frame strokeDash={[2, 4]} bind={{width: "id", nested: {value: -2}}} />',
    '<Frame><Text>\n  hello\n  world\n</Text></Frame>',
    '<Frame name="hello &quot;world&quot;" />',
    '<><Text>One</Text><Text>Two</Text></>',
    '<svg viewBox="0 0 24 24"><path d="M0 0L2 2" /></svg>'
  ]

  it.each(fixtures)('matches complete JSX semantics: %s', (source) => {
    const expected = resolveToTree(createElement(buildComponent(source), null))
    expect(withoutPositions(preview(source).tree)).toEqual(expected)
  })

  it.each(fixtures)('is independent of every two-chunk boundary: %s', (source) => {
    const expected = preview(source)
    for (let split = 0; split <= source.length; split++) {
      const parser = createStreamingJSXParser()
      parser.append(source.slice(0, split))
      expect(parser.append(source.slice(split))).toEqual(expected)
    }
  })

  it('supports one-code-unit chunks, including entities and surrogate pairs', () => {
    const source = '<Text>Hello &amp; goodbye 😀</Text>'
    const parser = createStreamingJSXParser()
    let result = parser.append('')
    // eslint-disable-next-line typescript-eslint/prefer-for-of -- Deliberately split UTF-16 surrogate pairs, unlike for-of.
    for (let index = 0; index < source.length; index++) result = parser.append(source[index] ?? '')
    expect(result).toEqual(preview(source))
    expect(preview('<Text>Hello &am').tree?.children).toEqual(['Hello '])
    expect(preview('<Text>Hello \uD83D').tree?.children).toEqual(['Hello '])
  })

  it('feeds progressive snapshots into the existing renderer on isolated graphs', async () => {
    const parser = createStreamingJSXParser()
    const chunks = [
      '<Frame w={400} h={200}>',
      '<Rect w={20} h={30} />',
      '<Rect w={40} h={50} /></Frame>'
    ]
    for (const [index, chunk] of chunks.entries()) {
      const tree = expectDefined(parser.append(chunk).tree, 'preview tree')
      const graph = makeSceneGraph()
      const result = await renderTree(graph, tree)
      const frame = getNodeOrThrow(graph, result.id)
      expect(frame.width).toBe(400)
      expect(frame.height).toBe(200)
      expect(frame.childIds).toHaveLength(index)
    }
  })

  it('reuses long prefixes without changing earlier node identities', () => {
    const prefix = '<Frame>' + '<Text>Repeated sibling</Text>'.repeat(100)
    const parser = createStreamingJSXParser()
    const first = parser.append(prefix)
    const tail = '<Text>Last</Text></Frame>'
    let result = first
    for (const chunk of tail) result = parser.append(chunk)
    expect(result).toEqual(preview(prefix + tail))
    expect(result.tree?.children.slice(0, 100)).toEqual(first.tree?.children)
  })

  it.each([
    'globalThis',
    'Math.random()',
    'new Date()',
    '({ get width() { throw 1 } })',
    '{["width"]: 2}',
    '{...props}',
    '[...items]',
    '/regex/',
    '2n',
    '1e999'
  ])('defers non-data expressions: %s', (expression) => {
    const result = preview(`<Frame w={${expression}} />`)
    expect(result.tree?.props).toEqual({})
    expect(result.pending.some(({ reason }) => reason === 'unsupported')).toBe(true)
  })

  it('keeps special attribute keys as own data properties', () => {
    const result = preview('<Frame __proto__={{polluted: true}} />')
    expect(Object.getPrototypeOf(result.tree?.props)).toBe(Object.prototype)
    expect(Object.hasOwn(result.tree?.props ?? {}, '__proto__')).toBe(true)
  })

  it('reports deferred non-scalar children', () => {
    expect(preview('<Text>{["not", "yet"]}</Text>').pending).toHaveLength(1)
  })

  it('can reset without retaining the preceding tool call', () => {
    const parser = createStreamingJSXParser()
    parser.append('<Frame><Text>Old')
    parser.reset()
    expect(parser.append('<Text>New</Text>')).toEqual(preview('<Text>New</Text>'))
  })

  it('bounds source size and projection depth', () => {
    const parser = createStreamingJSXParser()
    expect(() => parser.append('x'.repeat(128_001))).toThrow(RangeError)
    expect(parser.append('<Text>OK</Text>').tree?.type).toBe('text')
    expect(() => preview('<Frame>'.repeat(102))).toThrow(RangeError)
    expect(() => preview('<Frame>' + '<Rect/>'.repeat(10_000) + '</Frame>')).toThrow(RangeError)
  })
})

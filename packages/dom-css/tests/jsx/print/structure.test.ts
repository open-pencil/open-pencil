import { describe, expect, test } from 'bun:test'

import { sceneNodesToTailwindJSX } from '#dom-css/index'

import { makeGraph, pageId, tw } from './helpers'

describe('Tailwind JSX structure', () => {
  test('layer names cannot add attributes', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'a" onClick={alert(1)} x="',
      width: 100,
      height: 48
    })
    expect(tw(graph, node.id)).toStartWith(
      '<div data-name={"a\\" onClick={alert(1)} x=\\""} className='
    )
  })

  test('backslashes and line breaks in names use string literals', () => {
    const graph = makeGraph()
    const backslash = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'a\\b',
      width: 8,
      height: 8
    })
    const lines = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'two\nlines',
      width: 8,
      height: 8
    })
    expect(tw(graph, backslash.id)).toStartWith('<div data-name={"a\\\\b"} className=')
    expect(tw(graph, lines.id)).toStartWith('<div data-name={"two\\nlines"} className=')
  })

  test('basic rectangle — div with w/h', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Box',
      width: 100,
      height: 48
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<div')
    expect(jsx).toContain('data-name="Box"')
    expect(jsx).toContain('w-25')
    expect(jsx).toContain('h-12')
    expect(jsx).not.toContain('<Rectangle')
  })

  test('text node uses <p> with text classes', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Title',
      width: 200,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontWeight: 700,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<p')
    expect(jsx).toContain('text-lg')
    expect(jsx).toContain('font-bold')
    expect(jsx).toContain('text-black')
    expect(jsx).toContain('>Hello World</p>')
    expect(jsx).not.toContain('<Text')
  })

  test('section uses <section> tag', () => {
    const graph = makeGraph()
    const node = graph.createNode('SECTION', pageId(graph), {
      width: 800,
      height: 600
    })
    const jsx = tw(graph, node.id)
    expect(jsx).toContain('<section')
  })

  test('frame with children renders nested', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Card',
      width: 320,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ],
      cornerRadius: 12
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Title',
      width: 200,
      height: 20,
      text: 'Card Title',
      fontSize: 16,
      fontWeight: 700,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const jsx = tw(graph, frame.id)
    expect(jsx).toContain('<div')
    expect(jsx).toContain('flex flex-col')
    expect(jsx).toContain('gap-2')
    expect(jsx).toMatch(/rounded/)
    expect(jsx).toContain('  <p')
    expect(jsx).toContain('text-base')
    expect(jsx).toContain('font-bold')
    expect(jsx).toContain('>Card Title</p>')
    expect(jsx).toContain('</div>')
  })

  test('selections are separated by blank lines', () => {
    const graph = makeGraph()
    const a = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'A',
      width: 40,
      height: 40
    })
    const b = graph.createNode('ELLIPSE', pageId(graph), {
      name: 'B',
      width: 80,
      height: 80
    })
    const jsx = sceneNodesToTailwindJSX(graph, [a.id, b.id])
    expect(jsx).toContain('<div')
    expect(jsx).not.toContain('<Rectangle')
    expect(jsx).not.toContain('<Ellipse')
    expect(jsx).toContain('\n\n')
  })

  test('default values are omitted', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      opacity: 1,
      rotation: 0,
      cornerRadius: 0
    })
    const jsx = tw(graph, node.id)
    expect(jsx).not.toContain('opacity')
    expect(jsx).not.toContain('rotate')
    expect(jsx).not.toContain('rounded')
  })
})

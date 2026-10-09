import { describe, expect, test } from 'bun:test'

import { compact } from 'es-toolkit/array'

import { createSVGNodes } from '@open-pencil/core/io'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/**
 * Each tree is what Figma 126 built from the same markup, pasted as text and through
 * `figma.createNodeFromSvg`, which agree. Positions are relative to the imported frame, as
 * Figma reports them for layers inside groups.
 */
function layerTree(svg: string): string[] {
  const graph = new SceneGraph()
  const root = createSVGNodes(graph, graph.getPages()[0].id, svg)
  if (!root) throw new Error('Nothing imported')
  const lines: string[] = []
  const walk = (node: SceneNode, depth: number, originX: number, originY: number) => {
    const x = depth === 0 ? 0 : originX + node.x
    const y = depth === 0 ? 0 : originY + node.y
    const flags = compact([
      node.opacity !== 1 && `opacity=${node.opacity}`,
      node.isMask && `mask=${node.maskType}`
    ])
    lines.push(
      `${'  '.repeat(depth)}${node.type} "${node.name}" ${Math.round(x)},${Math.round(y)} ` +
        `${Math.round(node.width)}x${Math.round(node.height)}${flags.map((f) => ` ${f}`).join('')}`
    )
    for (const child of graph.getChildren(node.id)) walk(child, depth + 1, x, y)
  }
  walk(root, 0, 0, 0)
  return lines
}

describe('SVG import builds the layers Figma does', () => {
  test('groups per <g>, a vector per shape, named by id', () => {
    expect(
      layerTree(`<svg viewBox="0 0 120 80" width="120" height="80">
        <rect id="background" width="120" height="80" rx="8" fill="#EEF2FF"/>
        <g id="logo">
          <circle cx="30" cy="40" r="16" fill="#4F46E5"/>
          <path d="M24 40l5 5 9-10" fill="none" stroke="#fff" stroke-width="3"/>
        </g>
        <g id="label">
          <rect x="56" y="30" width="48" height="8" rx="4" fill="#1E1B4B"/>
          <rect x="56" y="44" width="32" height="6" rx="3" fill="#A5B4FC"/>
        </g>
      </svg>`)
    ).toEqual([
      'FRAME "Frame" 0,0 120x80',
      '  VECTOR "background" 0,0 120x80',
      '  GROUP "logo" 14,24 32x32',
      '    VECTOR "Vector" 14,24 32x32',
      '    VECTOR "Vector" 24,35 14x10',
      '  GROUP "label" 56,30 48x20',
      '    VECTOR "Vector" 56,30 48x8',
      '    VECTOR "Vector" 56,44 32x6'
    ])
  })

  test('names the frame after the root id; nested groups keep transforms and opacity', () => {
    expect(
      layerTree(
        '<svg id="icon-root" viewBox="0 0 100 100"><g><g transform="translate(10 10)" opacity="0.5"><rect width="20" height="20" fill="red"/><rect x="30" width="20" height="20" fill="red"/></g></g><title>Hello</title></svg>'
      )
    ).toEqual([
      'FRAME "icon-root" 0,0 100x100',
      '  GROUP "Group" 10,10 50x20',
      '    GROUP "Group" 10,10 50x20 opacity=0.5',
      '      VECTOR "Vector" 10,10 20x20',
      '      VECTOR "Vector" 40,10 20x20'
    ])
  })

  test('keeps paths with the same fill apart', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><path d="M0 0H40V40H0Z" fill="#000"/><path d="M50 0H90V40H50Z" fill="#000"/><path d="M0 50H40V90H0Z" fill="#f00"/></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  VECTOR "Vector" 0,0 40x40',
      '  VECTOR "Vector" 50,0 40x40',
      '  VECTOR "Vector" 0,50 40x40'
    ])
  })

  test('draws each <use> as its own vector, unnamed', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><circle id="dot" r="10" fill="blue"/></defs><use href="#dot" x="20" y="20"/><use xlink:href="#dot" x="60" y="60"/></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  VECTOR "Vector" 10,10 20x20',
      '  VECTOR "Vector" 50,50 20x20'
    ])
  })

  test('wraps a clipped group in a clip group sized to its mask', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><defs><clipPath id="c"><circle cx="50" cy="50" r="40"/></clipPath></defs><g clip-path="url(#c)"><rect width="100" height="50" fill="green"/><rect y="50" width="100" height="50" fill="orange"/></g></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 10,10 80x80',
      '    GROUP "c" 10,10 80x80 mask=VECTOR',
      '      VECTOR "Vector" 10,10 80x80',
      '    GROUP "Group" 0,0 100x100',
      '      VECTOR "Vector" 0,0 100x50',
      '      VECTOR "Vector" 0,50 100x50'
    ])
  })

  test('wraps a clipped shape, leaving its siblings outside', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><defs><clipPath id="c"><circle cx="50" cy="50" r="40"/></clipPath></defs><rect id="box" width="100" height="100" fill="red" clip-path="url(#c)"/><rect width="10" height="10" fill="blue"/></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 10,10 80x80',
      '    GROUP "c" 10,10 80x80 mask=VECTOR',
      '      VECTOR "Vector" 10,10 80x80',
      '    VECTOR "box" 0,0 100x100',
      '  VECTOR "Vector" 0,0 10x10'
    ])
  })

  test('draws a mask vector per clip shape and keeps the clipped group named', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><defs><clipPath id="c"><rect x="10" y="10" width="80" height="80"/><circle cx="5" cy="5" r="5"/></clipPath></defs><g id="art" clip-path="url(#c)" opacity="0.5"><rect width="100" height="100" fill="green"/></g></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 0,0 90x90',
      '    GROUP "c" 0,0 90x90 mask=VECTOR',
      '      VECTOR "Vector" 10,10 80x80',
      '      VECTOR "Vector" 0,0 10x10',
      '    GROUP "art" 0,0 100x100 opacity=0.5',
      '      VECTOR "Vector" 0,0 100x100'
    ])
  })

  test('nests clip groups for nested clips', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><defs><clipPath id="outer"><rect x="10" y="10" width="80" height="80"/></clipPath><clipPath id="inner"><circle cx="50" cy="50" r="25"/></clipPath></defs><g clip-path="url(#outer)"><rect width="100" height="100" fill="#f00" clip-path="url(#inner)"/></g></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 10,10 80x80',
      '    GROUP "outer" 10,10 80x80 mask=VECTOR',
      '      VECTOR "Vector" 10,10 80x80',
      '    GROUP "Group" 25,25 50x50',
      '      GROUP "Clip path group" 25,25 50x50',
      '        GROUP "inner" 25,25 50x50 mask=VECTOR',
      '          VECTOR "Vector" 25,25 50x50',
      '        VECTOR "Vector" 0,0 100x100'
    ])
  })

  test('maps an objectBoundingBox clip to the shape it clips', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 200 100"><defs><clipPath id="half" clipPathUnits="objectBoundingBox"><rect width="0.5" height="1"/></clipPath></defs><rect x="20" y="10" width="60" height="80" fill="#f00" clip-path="url(#half)"/></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 200x100',
      '  GROUP "Clip path group" 20,10 30x80',
      '    GROUP "half" 20,10 30x80 mask=VECTOR',
      '      VECTOR "Vector" 20,10 30x80',
      '    VECTOR "Vector" 20,10 60x80'
    ])
  })

  test('imports an SVG without a size as a group, with element opacity', () => {
    expect(
      layerTree(
        '<svg><rect width="50" height="50" fill="#f00" opacity="0.5"/><rect x="60" width="50" height="50" fill="#00f" fill-opacity="0.25"/><g fill="#0f0"><circle cx="20" cy="90" r="10"/></g></svg>'
      )
    ).toEqual([
      'GROUP "Group" 0,0 110x100',
      '  VECTOR "Vector" 0,0 50x50 opacity=0.5',
      '  VECTOR "Vector" 60,0 50x50',
      '  GROUP "Group" 10,80 20x20',
      '    VECTOR "Vector" 10,80 20x20'
    ])
  })

  test('drops empty groups and keeps single-layer groups', () => {
    expect(
      layerTree(
        '<svg viewBox="0 0 100 100"><g id="empty"></g><g id="one"><rect width="10" height="10"/></g><g><g><rect x="20" width="10" height="10"/></g></g></svg>'
      )
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "one" 0,0 10x10',
      '    VECTOR "Vector" 0,0 10x10',
      '  GROUP "Group" 20,0 10x10',
      '    GROUP "Group" 20,0 10x10',
      '      VECTOR "Vector" 20,0 10x10'
    ])
  })
})

describe('SVG import paints', () => {
  test('fills the frame white and clips to it, as Figma does', () => {
    const graph = new SceneGraph()
    const frame = createSVGNodes(
      graph,
      graph.getPages()[0].id,
      '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'
    )
    expect(frame?.clipsContent).toBe(true)
    expect(frame?.fills).toEqual([
      { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
    ])
  })

  test('applies fill-opacity and stroke-opacity to the paints', () => {
    const graph = new SceneGraph()
    const frame = createSVGNodes(
      graph,
      graph.getPages()[0].id,
      '<svg viewBox="0 0 10 10"><g fill-opacity="0.25"><rect width="10" height="10" fill="#00f" stroke="#000" stroke-opacity="0.5"/></g></svg>'
    )
    const group = graph.getChildren(frame?.id ?? '')[0]
    const [vector] = graph.getChildren(group?.id ?? '')
    expect(vector?.fills[0]?.opacity).toBe(0.25)
    expect(vector?.strokes[0]?.opacity).toBe(0.5)
  })
})

test('imports SVG files that start with an XML declaration and doctype', () => {
  const graph = new SceneGraph()
  const frame = createSVGNodes(
    graph,
    graph.getPages()[0].id,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="mark" width="10" height="10"/></svg>`
  )
  expect(graph.getChildren(frame?.id ?? '').map((node) => node.name)).toEqual(['mark'])
})

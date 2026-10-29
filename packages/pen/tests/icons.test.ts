import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { withIconTint } from '@open-pencil/scene-graph/icons'
import {
  hasInstanceOverride,
  instanceMainComponent,
  syncInstance
} from '@open-pencil/scene-graph/instances'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { expectDefined, getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

/** Draws each glyph as one path tinted with the icon's colour, as the Iconify source does. */
const icons = {
  draw(graph: SceneGraph, frameId: string, name: string, size: number, color: Color) {
    const path = graph.createNode('VECTOR', frameId, {
      name,
      width: size,
      height: size,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    graph.updateNode(path.id, { pluginData: withIconTint(path, ['fill']) })
    return true
  }
}

const item: PenNode = {
  id: 'item',
  type: 'frame',
  reusable: true,
  layout: 'horizontal',
  children: [
    {
      id: 'glyph',
      type: 'icon',
      library: 'lucide',
      icon: 'zap',
      width: 16,
      height: 16,
      fill: '#333333'
    },
    { id: 'label', type: 'text', content: 'Item', fill: '#333333' }
  ]
}

function read(...uses: PenNode[]) {
  return parseDocument([item, ...uses], {}, { icons })
}

function glyphOf(graph: SceneGraph, instanceId: string): SceneNode {
  return expectDefined(
    graph.getChildren(instanceId).find((node) => node.type === 'INSTANCE'),
    `the icon in ${instanceId}`
  )
}

describe('parsePenFile — icons in components', () => {
  test('reads an icon in a component as an instance of an icon component', () => {
    const graph = read()
    const glyph = getNodeOrThrow(graph, 'glyph')
    expect(glyph.type).toBe('INSTANCE')
    const component = expectDefined(instanceMainComponent(graph, glyph), 'icon component')
    expect(component.name).toBe('lucide/zap/16x16')
    expect(graph.getNode(component.parentId ?? '')?.name).toBe('Icons')
    expect(graph.getChildren(glyph.id).map((path) => path.componentId)).toEqual(
      graph.getChildren(component.id).map((path) => path.id)
    )
    expect(graph.getChildren(glyph.id)[0]?.fills[0]?.color).toMatchObject({ r: 0.2, g: 0.2 })
  })

  test('swaps the icon component an instance changes the icon to', () => {
    const graph = read({
      id: 'swapped',
      type: 'ref',
      ref: 'item',
      descendants: { glyph: { icon: 'star' } }
    })
    const glyph = glyphOf(graph, 'swapped')
    expect(instanceMainComponent(graph, glyph)?.name).toBe('lucide/star/16x16')
    // The layer keeps its name, as an override a saved file keeps.
    expect(glyph.name).toBe(getNodeOrThrow(graph, 'glyph').name)
    expect(hasInstanceOverride(graph, glyph.id, 'name')).toBe(true)
    // Every layer the instance holds is a copy of a component's layer, as a .fig file needs.
    const queue = [...graph.getChildren('swapped')]
    for (const node of queue) {
      expect(node.componentId).not.toBeNull()
      queue.push(...graph.getChildren(node.id))
    }
  })

  test('recolors the glyph an instance gives another colour, as an override', () => {
    const graph = read({
      id: 'recolored',
      type: 'ref',
      ref: 'item',
      descendants: { glyph: { fill: '#00CC00' } }
    })
    const path = expectDefined(graph.getChildren(glyphOf(graph, 'recolored').id)[0], 'path')
    expect(path.fills[0]?.color).toMatchObject({ r: 0, g: 0.8, b: 0 })
    expect(hasInstanceOverride(graph, path.id, 'fills')).toBe(true)
    const component = expectDefined(
      instanceMainComponent(graph, getNodeOrThrow(graph, 'glyph')),
      'icon component'
    )
    expect(graph.getChildren(component.id)[0]?.fills[0]?.color).toMatchObject({ r: 0, g: 0, b: 0 })
  })

  test('gives each size of a glyph its own component and keeps icons outside components', () => {
    const graph = read(
      {
        id: 'larger',
        type: 'ref',
        ref: 'item',
        descendants: { glyph: { width: 24, height: 24 } }
      },
      { id: 'loose', type: 'icon', library: 'lucide', icon: 'zap', width: 16, height: 16 }
    )
    expect(instanceMainComponent(graph, glyphOf(graph, 'larger'))?.name).toBe('lucide/zap/24x24')
    expect(getNodeOrThrow(graph, 'loose').type).toBe('FRAME')
  })

  test('keeps what an icon sets on itself when an instance swaps its component', () => {
    const faded: PenNode = {
      id: 'faded-item',
      type: 'frame',
      reusable: true,
      children: [
        {
          id: 'faded-glyph',
          type: 'icon',
          library: 'lucide',
          icon: 'zap',
          width: 16,
          height: 16,
          opacity: 0.5
        }
      ]
    }
    const graph = parseDocument(
      [
        faded,
        {
          id: 'swapped',
          type: 'ref',
          ref: 'faded-item',
          descendants: { 'faded-glyph': { icon: 'star' } }
        },
        {
          id: 'fainter',
          type: 'ref',
          ref: 'faded-item',
          descendants: { 'faded-glyph': { icon: 'star', opacity: 0.25 } }
        }
      ],
      {},
      { icons }
    )
    expect(getNodeOrThrow(graph, 'faded-glyph').opacity).toBe(0.5)
    for (const [id, opacity] of [
      ['swapped', 0.5],
      ['fainter', 0.25]
    ] as const) {
      const glyph = glyphOf(graph, id)
      expect(instanceMainComponent(graph, glyph)?.name).toBe('lucide/star/16x16')
      expect(glyph.opacity).toBe(opacity)
      syncInstance(graph, glyph.id)
      expect(glyphOf(graph, id).opacity).toBe(opacity)
    }
  })
})

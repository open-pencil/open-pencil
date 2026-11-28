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
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import { parseDocument } from './helpers/document'
import { lightDark, SEMANTIC_THEMES } from './helpers/themes'

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
      for (const child of graph.getChildren(node.id)) queue.push(child)
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

  // A theme re-read swaps the icon onto the glyph component for that theme, and a descendant
  // override that follows still has to find the layer it names (#2170).
  test('hides an icon a theme swaps when a descendant override disables it', () => {
    const graph = parseDocument(
      [
        {
          id: 'Card',
          type: 'frame',
          reusable: true,
          children: [
            {
              id: 'symbol',
              type: 'icon',
              library: 'lucide',
              icon: '$glyph',
              width: 16,
              height: 16
            }
          ]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          children: [
            {
              id: 'placed',
              type: 'ref',
              ref: 'Card',
              descendants: { symbol: { enabled: false } }
            }
          ]
        }
      ],
      { themes: SEMANTIC_THEMES, variables: { glyph: lightDark('string', 'sun', 'moon') } },
      { icons }
    )
    const symbol = expectDefined(graph.getChildren('placed')[0], 'symbol')

    expect(instanceMainComponent(graph, getNodeOrThrow(graph, 'symbol'))?.name).toBe(
      'lucide/sun/16x16'
    )
    expect(instanceMainComponent(graph, symbol)?.name).toBe('lucide/moon/16x16')
    expect(symbol.visible).toBe(false)
  })

  test('hides a nested icon a theme swaps when a descendant override disables it', () => {
    const graph = parseDocument(
      [
        {
          id: 'Card',
          type: 'frame',
          reusable: true,
          children: [
            {
              id: 'symbol',
              type: 'icon',
              library: 'lucide',
              icon: '$glyph',
              width: 16,
              height: 16
            }
          ]
        },
        {
          id: 'Row',
          type: 'frame',
          reusable: true,
          children: [{ id: 'RowCard', type: 'ref', ref: 'Card' }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          children: [
            {
              id: 'RowInst',
              type: 'ref',
              ref: 'Row',
              descendants: { 'RowCard/symbol': { enabled: false } }
            }
          ]
        }
      ],
      { themes: SEMANTIC_THEMES, variables: { glyph: lightDark('string', 'sun', 'moon') } },
      { icons }
    )
    const card = expectDefined(graph.getChildren('RowInst')[0], 'nested card')
    const symbol = expectDefined(graph.getChildren(card.id)[0], 'nested symbol')

    expect(instanceMainComponent(graph, symbol)?.name).toBe('lucide/moon/16x16')
    expect(symbol.visible).toBe(false)
  })

  // An icon an override sets on a nested instance belongs to the icon layer inside it, so
  // each button of a theme switcher shows its swapped icon rather than the default (#2171).
  test('swaps the icons descendants overrides set on nested icon-button instances', () => {
    const iconButton: PenNode = {
      id: 'IconButton',
      type: 'frame',
      reusable: true,
      children: [
        {
          id: 'glyph',
          type: 'icon',
          library: 'lucide',
          icon: 'plus',
          width: 16,
          height: 16,
          fill: '#333333'
        }
      ]
    }
    const row: PenNode = {
      id: 'Row',
      type: 'frame',
      reusable: true,
      layout: 'horizontal',
      children: [
        { id: 'sun-button', type: 'ref', ref: 'IconButton' },
        { id: 'moon-button', type: 'ref', ref: 'IconButton' },
        { id: 'monitor-button', type: 'ref', ref: 'IconButton' },
        { id: 'palette-button', type: 'ref', ref: 'IconButton' }
      ]
    }
    const graph = parseDocument(
      [
        iconButton,
        row,
        {
          id: 'switcher',
          type: 'ref',
          ref: 'Row',
          descendants: {
            'sun-button': { icon: 'sun' },
            'moon-button': { icon: 'moon' },
            'monitor-button': { icon: 'monitor' },
            'palette-button': { icon: 'palette' }
          }
        }
      ],
      {},
      { icons }
    )
    const glyphOf = (instanceId: string, index: number): SceneNode => {
      const button = expectDefined(graph.getChildren(instanceId)[index], `button ${index}`)
      return expectDefined(
        graph.getChildren(button.id).find((node) => node.type === 'INSTANCE'),
        `glyph in button ${index}`
      )
    }
    for (const [index, icon] of [
      [0, 'lucide/sun/16x16'],
      [1, 'lucide/moon/16x16'],
      [2, 'lucide/monitor/16x16'],
      [3, 'lucide/palette/16x16']
    ] as const) {
      expect(instanceMainComponent(graph, glyphOf('switcher', index))?.name).toBe(icon)
    }
    // The component's own buttons still show its default icon.
    expect(instanceMainComponent(graph, glyphOf('Row', 0))?.name).toBe('lucide/plus/16x16')
  })

  test('swaps the icons a further-out instance sets on nested icon-button instances', () => {
    const iconButton: PenNode = {
      id: 'IconButton',
      type: 'frame',
      reusable: true,
      children: [
        {
          id: 'glyph',
          type: 'icon',
          library: 'lucide',
          icon: 'plus',
          width: 16,
          height: 16
        }
      ]
    }
    const row: PenNode = {
      id: 'Row',
      type: 'frame',
      reusable: true,
      layout: 'horizontal',
      children: [
        { id: 'sun-button', type: 'ref', ref: 'IconButton' },
        { id: 'moon-button', type: 'ref', ref: 'IconButton' }
      ]
    }
    const sidebar: PenNode = {
      id: 'Sidebar',
      type: 'frame',
      reusable: true,
      children: [{ id: 'switcher', type: 'ref', ref: 'Row' }]
    }
    const graph = parseDocument(
      [
        iconButton,
        row,
        sidebar,
        {
          id: 'sidebar-inst',
          type: 'ref',
          ref: 'Sidebar',
          descendants: {
            'switcher/sun-button': { icon: 'sun' },
            'switcher/moon-button': { icon: 'moon' }
          }
        }
      ],
      {},
      { icons }
    )
    const switcher = expectDefined(graph.getChildren('sidebar-inst')[0], 'switcher copy')
    for (const [index, icon] of [
      [0, 'lucide/sun/16x16'],
      [1, 'lucide/moon/16x16']
    ] as const) {
      const button = expectDefined(graph.getChildren(switcher.id)[index], `button ${index}`)
      const glyph = expectDefined(
        graph.getChildren(button.id).find((node) => node.type === 'INSTANCE'),
        `glyph in button ${index}`
      )
      expect(instanceMainComponent(graph, glyph)?.name).toBe(icon)
    }
  })

  test('swaps the icon a ref sets on its own icon-button instance', () => {
    const iconButton: PenNode = {
      id: 'IconButton',
      type: 'frame',
      reusable: true,
      children: [
        {
          id: 'glyph',
          type: 'icon',
          library: 'lucide',
          icon: 'plus',
          width: 16,
          height: 16
        }
      ]
    }
    const row: PenNode = {
      id: 'Row',
      type: 'frame',
      reusable: true,
      layout: 'horizontal',
      children: [
        { id: 'sun-button', type: 'ref', ref: 'IconButton', icon: 'sun' },
        { id: 'moon-button', type: 'ref', ref: 'IconButton', icon: 'moon' }
      ]
    }
    const graph = parseDocument(
      [iconButton, row, { id: 'switcher', type: 'ref', ref: 'Row' }],
      {},
      { icons }
    )
    for (const [instanceId, index, icon] of [
      ['Row', 0, 'lucide/sun/16x16'],
      ['Row', 1, 'lucide/moon/16x16'],
      ['switcher', 0, 'lucide/sun/16x16'],
      ['switcher', 1, 'lucide/moon/16x16']
    ] as const) {
      const button = expectDefined(graph.getChildren(instanceId)[index], `button ${index}`)
      const glyph = expectDefined(
        graph.getChildren(button.id).find((node) => node.type === 'INSTANCE'),
        `glyph in button ${index}`
      )
      expect(instanceMainComponent(graph, glyph)?.name).toBe(icon)
    }
  })
})

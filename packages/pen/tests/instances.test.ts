import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { hasInstanceOverride, syncInstance } from '@open-pencil/scene-graph/instances'

import { expectDefined, getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

const button: PenNode = {
  id: 'button',
  type: 'frame',
  reusable: true,
  layout: 'horizontal',
  alignItems: 'center',
  padding: [8, 14],
  gap: 6,
  fill: '#2255CC',
  children: [
    { id: 'dot', type: 'ellipse', width: 10, height: 10, fill: '#FFFFFF' },
    { id: 'label', type: 'text', content: 'Button', fontSize: 14, fill: '#FFFFFF' }
  ]
}

const card: PenNode = {
  id: 'card',
  type: 'frame',
  reusable: true,
  layout: 'vertical',
  children: [
    { id: 'title', type: 'text', content: 'Card title', fill: '#111111' },
    { id: 'cardButton', type: 'ref', ref: 'button' }
  ]
}

function layers(graph: SceneGraph, id: string): SceneNode[] {
  const found: SceneNode[] = []
  const queue = [...graph.getChildren(id)]
  for (const node of queue) {
    found.push(node)
    queue.push(...graph.getChildren(node.id))
  }
  return found
}

/** The copy in an instance made, through copies of copies, from the pen.dev layer `sourceId`. */
function copyOf(graph: SceneGraph, instanceId: string, sourceId: string): SceneNode {
  const madeFrom = (node: SceneNode): boolean => {
    for (let id = node.componentId; id; id = graph.getNode(id)?.componentId ?? null) {
      if (id === sourceId) return true
    }
    return false
  }
  return expectDefined(layers(graph, instanceId).find(madeFrom), `${sourceId} in ${instanceId}`)
}

describe('parsePenFile — instances', () => {
  test('fills an instance with copies linked to the component', () => {
    const graph = parseDocument([button, { id: 'plain', type: 'ref', ref: 'button' }])
    const instance = getNodeOrThrow(graph, 'plain')
    expect(instance.type).toBe('INSTANCE')
    expect(instance.componentId).toBe('button')
    expect(graph.getChildren('plain').map((node) => node.componentId)).toEqual(['dot', 'label'])
  })

  test('replaces the component fields the ref sets, keeping the rest', () => {
    const graph = parseDocument([
      button,
      { id: 'tall', type: 'ref', ref: 'button', layout: 'vertical', padding: 12 }
    ])
    expect(getNodeOrThrow(graph, 'tall')).toMatchObject({
      layoutMode: 'VERTICAL',
      counterAxisAlign: 'CENTER',
      itemSpacing: 6,
      paddingTop: 12,
      paddingLeft: 12
    })
  })

  test('overrides a descendant by its ID', () => {
    const graph = parseDocument([
      button,
      { id: 'changed', type: 'ref', ref: 'button', descendants: { label: { content: 'Changed' } } }
    ])
    expect(copyOf(graph, 'changed', 'label').text).toBe('Changed')
    expect(getNodeOrThrow(graph, 'label').text).toBe('Button')
  })

  test("records the instance's own fields as overrides, its size only when it sets one", () => {
    const graph = parseDocument([
      button,
      { id: 'tinted', type: 'ref', ref: 'button', fill: '#119944' },
      { id: 'sized', type: 'ref', ref: 'button', width: 200 }
    ])
    expect(hasInstanceOverride(graph, 'tinted', 'fills')).toBe(true)
    expect(hasInstanceOverride(graph, 'tinted', 'width')).toBe(false)
    expect(hasInstanceOverride(graph, 'sized', 'width')).toBe(true)

    syncInstance(graph, 'tinted')

    expect(getNodeOrThrow(graph, 'tinted').fills[0]?.color).toMatchObject({ r: 0x11 / 255 })
  })

  test('records the fields a stroke writes, not the ones it leaves to its paints', () => {
    const graph = parseDocument([
      button,
      { id: 'outlined', type: 'ref', ref: 'button', stroke: { fill: '#111111', thickness: 2 } }
    ])
    const recorded = (field: string) => hasInstanceOverride(graph, 'outlined', field)
    expect(['strokes', 'strokeCap', 'strokeJoin'].map(recorded)).toEqual([true, true, true])
    expect(['strokeWeight', 'strokeAlign', 'dashPattern'].map(recorded)).toEqual([
      false,
      false,
      false
    ])
  })

  test("keeps a field the ref sets to its component's value when the component changes", () => {
    const graph = parseDocument([
      button,
      {
        id: 'same',
        type: 'ref',
        ref: 'button',
        fill: '#2255CC',
        descendants: { label: { content: 'Button' } }
      }
    ])
    expect(hasInstanceOverride(graph, 'same', 'fills')).toBe(true)
    expect(hasInstanceOverride(graph, copyOf(graph, 'same', 'label').id, 'text')).toBe(true)

    graph.updateNode('button', {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    graph.updateNode('label', { text: 'Renamed' })
    syncInstance(graph, 'same')

    expect(getNodeOrThrow(graph, 'same').fills[0]?.color).toMatchObject({ r: 0x22 / 255 })
    expect(copyOf(graph, 'same', 'label').text).toBe('Button')
  })

  test('records a descendant override so a sync keeps it', () => {
    const graph = parseDocument([
      button,
      {
        id: 'kept',
        type: 'ref',
        ref: 'button',
        descendants: { label: { content: 'Kept' }, dot: { enabled: false } }
      }
    ])
    const label = copyOf(graph, 'kept', 'label')
    expect(hasInstanceOverride(graph, label.id, 'text')).toBe(true)
    expect(hasInstanceOverride(graph, label.id, 'fills')).toBe(false)

    syncInstance(graph, 'kept')

    expect(copyOf(graph, 'kept', 'label').text).toBe('Kept')
    expect(copyOf(graph, 'kept', 'dot').visible).toBe(false)
  })

  test('follows an ID path through a nested instance', () => {
    const graph = parseDocument([
      button,
      card,
      {
        id: 'nested',
        type: 'ref',
        ref: 'card',
        descendants: { 'cardButton/label': { content: 'Deep' }, cardButton: { fill: '#119944' } }
      }
    ])
    const nestedButton = expectDefined(
      graph.getChildren('nested').find((node) => node.componentId === 'cardButton'),
      'nested button copy'
    )
    expect(nestedButton.fills[0]?.color).toMatchObject({ r: 0x11 / 255, g: 0x99 / 255 })
    expect(copyOf(graph, nestedButton.id, 'label').text).toBe('Deep')
  })

  test('replaces a descendant whose override has a type', () => {
    const graph = parseDocument([
      button,
      {
        id: 'swapped',
        type: 'ref',
        ref: 'button',
        descendants: {
          dot: { type: 'rectangle', id: 'square', width: 10, height: 10, fill: '#FFFF00' }
        }
      }
    ])
    expect(graph.getChildren('swapped').map((node) => node.type)).toEqual(['RECTANGLE', 'TEXT'])
    expect(getNodeOrThrow(graph, 'square').fills[0]?.color).toMatchObject({ r: 1, g: 1, b: 0 })
  })

  test('detaches an instance whose override replaces a layer or its children', () => {
    const graph = parseDocument([
      button,
      card,
      {
        id: 'replacedLayer',
        type: 'ref',
        ref: 'button',
        descendants: { dot: { type: 'rectangle', id: 'square', width: 10, height: 10 } }
      },
      {
        id: 'replacedChildren',
        type: 'ref',
        ref: 'card',
        descendants: {
          cardButton: { children: [{ id: 'note', type: 'text', content: 'Note' }] }
        }
      },
      { id: 'kept', type: 'ref', ref: 'card' }
    ])
    // Instances keep their component's layers, so these become frames showing the same layers.
    expect(getNodeOrThrow(graph, 'replacedLayer')).toMatchObject({
      type: 'FRAME',
      componentId: null
    })
    expect(graph.getChildren('replacedLayer').map((node) => node.type)).toEqual([
      'RECTANGLE',
      'TEXT'
    ])
    expect(getNodeOrThrow(graph, 'replacedChildren').type).toBe('FRAME')
    // The card's second layer is its button.
    const nested = expectDefined(graph.getChildren('replacedChildren')[1], 'nested button')
    expect(nested.type).toBe('FRAME')
    expect(graph.getChildren(nested.id).map((node) => node.text)).toEqual(['Note'])
    expect(getNodeOrThrow(graph, 'kept').type).toBe('INSTANCE')
    expect(graph.getChildren('kept')[1]?.type).toBe('INSTANCE')
  })

  test('keeps a replacement that is an instance of another component', () => {
    const badge: PenNode = {
      id: 'badge',
      type: 'frame',
      reusable: true,
      children: [{ id: 'badgeLabel', type: 'text', content: 'New' }]
    }
    const graph = parseDocument([
      button,
      badge,
      {
        id: 'withBadge',
        type: 'ref',
        ref: 'button',
        descendants: { dot: { type: 'ref', id: 'swappedBadge', ref: 'badge' } }
      }
    ])
    expect(getNodeOrThrow(graph, 'withBadge').type).toBe('FRAME')
    expect(getNodeOrThrow(graph, 'swappedBadge')).toMatchObject({
      type: 'INSTANCE',
      componentId: 'badge'
    })
    expect(graph.getChildren('swappedBadge').map((node) => node.text)).toEqual(['New'])
  })

  test('swaps a nested instance a replacement makes an instance of another component', () => {
    const badge: PenNode = {
      id: 'badge',
      type: 'frame',
      reusable: true,
      children: [{ id: 'badgeLabel', type: 'text', content: 'New' }]
    }
    const graph = parseDocument([
      button,
      card,
      badge,
      {
        id: 'withBadge',
        type: 'ref',
        ref: 'card',
        descendants: {
          cardButton: {
            type: 'ref',
            ref: 'badge',
            name: 'Status',
            descendants: { badgeLabel: { content: 'Sale' } }
          }
        }
      }
    ])
    // As Figma's instance swap: the card stays an instance and its button shows the badge.
    expect(getNodeOrThrow(graph, 'withBadge').type).toBe('INSTANCE')
    const swapped = expectDefined(graph.getChildren('withBadge')[1], 'swapped button')
    expect(swapped).toMatchObject({ type: 'INSTANCE', componentId: 'badge', name: 'Status' })
    expect(graph.getChildren(swapped.id).map((node) => node.text)).toEqual(['Sale'])
    // Its overrides are recorded, so a sync keeps them.
    syncInstance(graph, 'withBadge')
    expect(graph.getChildren(swapped.id).map((node) => node.text)).toEqual(['Sale'])
  })

  test('hides a descendant through its enabled field', () => {
    const graph = parseDocument([
      button,
      { id: 'hidden', type: 'ref', ref: 'button', descendants: { dot: { enabled: false } } }
    ])
    expect(copyOf(graph, 'hidden', 'dot').visible).toBe(false)
  })

  test('copies a reusable layer that is not a frame', () => {
    const graph = parseDocument([
      { id: 'swatch', type: 'rectangle', reusable: true, width: 20, height: 20, fill: '#FF0000' },
      { id: 'use', type: 'ref', ref: 'swatch', x: 40 }
    ])
    expect(getNodeOrThrow(graph, 'use')).toMatchObject({ type: 'RECTANGLE', x: 40, width: 20 })
  })
})

import { describe, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Recorded with the same script in Figma desktop 126.

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  const host = figma.createFrame()
  host.resize(800, 600)
  const rect = (name: string, x: number) => {
    const node = figma.createRectangle()
    node.name = name
    node.resize(50, 50)
    node.x = x
    host.appendChild(node)
    return node
  }
  const order = () => host.children.map((child: FigmaNodeProxy) => child.name)
  return { figma, host, rect, order }
}

describe('plugin API structure parity', () => {
  test('a group without an index goes on top of its parent', () => {
    const { figma, host, rect, order } = setup()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host)
    expect(group.name).toBe('Group')
    expect(order()).toEqual(['a', 'd', 'Group'])
  })

  test('ungroup puts the children in the group’s place in the stack', () => {
    const { figma, host, rect, order } = setup()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host, 1)
    expect(order()).toEqual(['a', 'Group', 'd'])
    expect(figma.ungroup(group).map((child) => child.name)).toEqual(['b', 'c'])
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  test('a boolean operation is named after it and filled with the default grey', () => {
    const { figma, host, rect, order } = setup()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 120)
    // Scripts pass Figma paints, which carry no alpha.
    Reflect.set(b, 'fills', [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }])
    const union = figma.union([b, c], host)
    expect(union.name).toBe('Union')
    expect(order()).toEqual(['a', 'Union'])
    const raw = figma.graph.getNode(union.id)
    expect(raw?.fills[0]?.color.r).toBeCloseTo(217 / 255)
    expect(raw?.childIds).toEqual([b.id, c.id])
    expect(figma.subtract([rect('e', 0), rect('f', 10)], host).name).toBe('Subtract')
  })

  test('a component from a layer wraps it in a white component named after it', () => {
    const { figma, rect, order } = setup()
    rect('a', 0)
    const r = rect('r', 100)
    rect('z', 300)
    const component = figma.createComponentFromNode(r)
    expect(component.type).toBe('COMPONENT')
    expect(component.name).toBe('r')
    expect([component.x, component.y, component.width, component.height]).toEqual([100, 0, 50, 50])
    expect(component.fills[0]?.color).toMatchObject({ r: 1, g: 1, b: 1 })
    expect(order()).toEqual(['a', 'r', 'z'])
    expect(r.removed).toBe(false)
    expect(component.children[0]?.id).toBe(r.id)
    expect([r.x, r.y]).toEqual([0, 0])
  })

  test('a component from a frame keeps its place, look, and children', () => {
    const { figma, host, rect, order } = setup()
    rect('a', 0)
    const frame = figma.createFrame()
    frame.name = 'f'
    frame.x = 100
    frame.cornerRadius = 4
    host.appendChild(frame)
    const inner = figma.createEllipse()
    frame.appendChild(inner)
    rect('z', 300)
    const component = figma.createComponentFromNode(frame)
    expect(order()).toEqual(['a', 'f', 'z'])
    expect(component.cornerRadius).toBe(4)
    expect(component.clipsContent).toBe(true)
    expect(component.children.map((child: FigmaNodeProxy) => child.id)).toEqual([inner.id])
    expect(frame.removed).toBe(true)
  })

  test('a component from a group takes its place and children, with no fill', () => {
    const { figma, host, rect, order } = setup()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host, 1)
    group.name = 'grp'
    const component = figma.createComponentFromNode(group)
    expect(order()).toEqual(['a', 'grp', 'd'])
    expect(component.fills).toEqual([])
    expect(component.children.map((child: FigmaNodeProxy) => child.id)).toEqual([b.id, c.id])
    expect([b.x, c.x]).toEqual([0, 100])
    expect(group.removed).toBe(true)
  })
})

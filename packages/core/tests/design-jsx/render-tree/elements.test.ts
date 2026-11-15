import { describe, expect, it } from 'bun:test'

import { renderTree, renderJSX } from '@open-pencil/core/design-jsx'
import {
  Frame,
  Text,
  Rectangle,
  Ellipse,
  Line,
  Star,
  Group,
  Section,
  Component,
  ComponentSet,
  Instance
} from '@open-pencil/design-jsx'
import { expectDefined, getNodeOrThrow, childIdAt } from '@open-pencil/test-support/assert'
import { makeSceneGraph } from '@open-pencil/test-support/scene'

describe('renderTree', () => {
  it('renders a simple frame', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'MyFrame', w: 200, h: 100, bg: '#FF0000' })
    const result = await renderTree(g, tree)

    expect(result.name).toBe('MyFrame')
    expect(result.type).toBe('FRAME')

    const node = getNodeOrThrow(g, result.id)
    expect(node.width).toBe(200)
    expect(node.height).toBe(100)
    expect(node.fills.length).toBe(1)
    expect(expectDefined(node.fills[0], 'first fill').type).toBe('SOLID')
  })

  it('renders text node with content', async () => {
    const g = makeSceneGraph()
    const tree = Text({
      name: 'Heading',
      size: 24,
      weight: 'bold',
      color: '#111',
      children: 'Hello'
    })
    const result = await renderTree(g, tree)

    const node = getNodeOrThrow(g, result.id)
    expect(node.type).toBe('TEXT')
    expect(node.text).toBe('Hello')
    expect(node.fontSize).toBe(24)
    expect(node.fontWeight).toBe(700)
    expect(node.fills.length).toBe(1)
  })

  it('renders common React aliases that models often produce', async () => {
    const g = makeSceneGraph()
    const result = await renderJSX(
      g,
      `<div name="Card" style={{ width: 320, height: 120, backgroundColor: '#2563EB', borderRadius: 16 }}>
        <Text name="Heading" content="Visible content" style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700 }} />
      </div>`
    )

    const card = getNodeOrThrow(g, result[0].id)
    expect(card.type).toBe('FRAME')
    expect(card.width).toBe(320)
    expect(card.height).toBe(120)
    expect(card.cornerRadius).toBe(16)
    expect(card.fills.length).toBe(1)

    const heading = getNodeOrThrow(g, childIdAt(card, 0))
    expect(heading.type).toBe('TEXT')
    expect(heading.text).toBe('Visible content')
    expect(heading.fontSize).toBe(20)
    expect(heading.fontWeight).toBe(700)
    expect(heading.fills.length).toBe(1)
  })

  it('renders components and instances', async () => {
    const g = makeSceneGraph()
    const component = await renderTree(
      g,
      Component({
        name: 'Badge',
        w: 64,
        h: 24,
        children: [Text({ name: 'Label', color: '#000', children: 'Live' })]
      })
    )

    const instance = await renderTree(
      g,
      Instance({ component: component.id, name: 'Badge Instance' })
    )
    const node = getNodeOrThrow(g, instance.id)

    expect(component.type).toBe('COMPONENT')
    expect(node.type).toBe('INSTANCE')
    expect(node.componentId).toBe(component.id)
    expect(node.childIds.length).toBe(1)
  })

  it('renders component sets and variant instances', async () => {
    const g = makeSceneGraph()
    const set = await renderTree(
      g,
      ComponentSet({
        name: 'Button',
        children: [
          Component({ name: 'variant=Primary', w: 120, h: 40, bg: '#2563EB' }),
          Component({ name: 'variant=Secondary', w: 120, h: 40, bg: '#FFFFFF' })
        ]
      })
    )

    const setNode = getNodeOrThrow(g, set.id)
    expect(setNode.type).toBe('COMPONENT_SET')
    expect(setNode.componentPropertyDefinitions[0]?.name).toBe('variant')

    const instance = await renderTree(g, Instance({ of: set.id, variant: 'Secondary' }))
    const node = getNodeOrThrow(g, instance.id)
    expect(node.type).toBe('INSTANCE')
    expect(getNodeOrThrow(g, node.componentId ?? '').name).toBe('variant=Secondary')
  })

  it('renders nested structure', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'Card',
      w: 320,
      flex: 'col',
      gap: 16,
      p: 24,
      bg: '#FFF',
      children: [
        Rectangle({ name: 'Image', w: 272, h: 200, bg: '#E5E7EB' }),
        Text({ name: 'Title', size: 18, weight: 'bold', color: '#111', children: 'Card Title' }),
        Text({ name: 'Description', size: 14, color: '#6B7280', children: 'Lorem ipsum' })
      ]
    })
    const result = await renderTree(g, tree)

    const card = getNodeOrThrow(g, result.id)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(16)
    expect(card.paddingTop).toBe(24)
    expect(card.paddingRight).toBe(24)
    expect(card.childIds.length).toBe(3)

    const title = getNodeOrThrow(g, childIdAt(card, 1))
    expect(title.text).toBe('Card Title')
    expect(title.fontWeight).toBe(700)
  })

  it('renders with position override', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Positioned', w: 100, h: 100 })
    const result = await renderTree(g, tree, { x: 50, y: 75 })

    const node = getNodeOrThrow(g, result.id)
    expect(node.x).toBe(50)
    expect(node.y).toBe(75)
  })

  it('renders into a specific parent', async () => {
    const g = makeSceneGraph()
    const page = expectDefined(g.getPages()[0], 'first page')
    const container = g.createNode('FRAME', page.id, { name: 'Container' })

    const tree = Frame({ name: 'Child', w: 50, h: 50 })
    await renderTree(g, tree, { parentId: container.id })

    expect(container.childIds.length).toBe(1)
  })

  it('renders all primitive types', async () => {
    const g = makeSceneGraph()
    const types = [
      { fn: Rectangle, expected: 'RECTANGLE' },
      { fn: Ellipse, expected: 'ELLIPSE' },
      { fn: Line, expected: 'LINE' },
      { fn: Star, expected: 'STAR' },
      { fn: Group, expected: 'GROUP' },
      { fn: Section, expected: 'SECTION' }
    ] as const

    for (const { fn, expected } of types) {
      const tree = fn({ name: expected })
      const result = await renderTree(g, tree)
      expect(getNodeOrThrow(g, result.id).type).toBe(expected)
    }
  })

  it('throws on unknown element type', () => {
    const g = makeSceneGraph()
    const tree = { type: 'foobar', props: {}, children: [] }
    expect(() => renderTree(g, tree)).toThrow('Unknown element: <foobar>')
  })
})

describe('fragments', () => {
  it('renders every root of a fragment and returns the first', async () => {
    const g = makeSceneGraph()
    const pageId = g.getPages()[0].id
    const before = getNodeOrThrow(g, pageId).childIds.length
    const result = await renderTree(g, {
      type: '',
      props: {},
      children: [Frame({ name: 'A', w: 10, h: 10 }), Frame({ name: 'B', w: 10, h: 10 })]
    })
    expect(result.name).toBe('A')
    expect(getNodeOrThrow(g, pageId).childIds.length).toBe(before + 2)
  })

  it('renders a nested fragment into its parent', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      '<Frame name="Card"><><Text>One</Text><Text>Two</Text></></Frame>'
    )
    const card = getNodeOrThrow(g, result.id)
    expect(card.childIds.map((id) => getNodeOrThrow(g, id).text)).toEqual(['One', 'Two'])
  })
})

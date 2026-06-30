import { describe, expect, it } from 'bun:test'

import {
  renderTree,
  renderJSX,
  renderTreeNode,
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
  Instance,
  defineVars,
  designVar,
  dropShadow,
  innerShadow,
  layerBlur,
  linearGradient,
  solid
} from '@open-pencil/core'

import { expectDefined, getNodeOrThrow, childIdAt } from '#tests/helpers/assert'
import { addTestColorVariable, makeSceneGraph } from '#tests/helpers/scene'

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

  it('renders structured fill helpers', async () => {
    const g = makeSceneGraph()
    const result = await renderTree(
      g,
      Frame({
        name: 'Paints',
        w: 200,
        h: 100,
        fills: [
          solid('#112233'),
          linearGradient([
            ['#ffffff', 0],
            ['rgba(0, 0, 0, 0)', 1]
          ])
        ]
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.fills).toHaveLength(2)
    expect(node.fills[0]?.type).toBe('SOLID')
    expect(node.fills[1]?.type).toBe('GRADIENT_LINEAR')
    expect(node.fills[1]?.gradientStops).toHaveLength(2)
  })

  it('renders structured fill helpers from JSX strings', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame name="Paints" w={200} h={100} fills={[solid('#112233'), linearGradient([['#fff', 0], ['#0000', 1]])]} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.fills).toHaveLength(2)
    expect(node.fills[1]?.type).toBe('GRADIENT_LINEAR')
  })

  it('renders structured effect helpers', async () => {
    const g = makeSceneGraph()
    const result = await renderTree(
      g,
      Frame({
        name: 'Effects',
        w: 200,
        h: 100,
        effects: [
          dropShadow({ x: 0, y: 8, radius: 16 }),
          innerShadow({ color: '#ff000080' }),
          layerBlur(4)
        ]
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects).toHaveLength(3)
    expect(node.effects[0]?.type).toBe('DROP_SHADOW')
    expect(node.effects[0]?.offset.y).toBe(8)
    expect(node.effects[1]?.type).toBe('INNER_SHADOW')
    expect(node.effects[2]?.type).toBe('LAYER_BLUR')
  })

  it('renders structured effect helpers from JSX strings', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame name="Effects" w={200} h={100} effects={[dropShadow({ x: 0, y: 8, radius: 16 }), backgroundBlur(12)]} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects).toHaveLength(2)
    expect(node.effects[0]?.type).toBe('DROP_SHADOW')
    expect(node.effects[1]?.type).toBe('BACKGROUND_BLUR')
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

  it('binds variable refs used as style values', async () => {
    const g = makeSceneGraph()
    g.addCollection({
      id: 'colors',
      name: 'Colors',
      modes: [{ modeId: 'light', name: 'Light' }],
      defaultModeId: 'light',
      variableIds: []
    })
    g.addVariable({
      id: 'var-bg',
      name: 'Background',
      type: 'COLOR',
      collectionId: 'colors',
      valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const vars = defineVars({ bg: { id: 'var-bg', name: 'Background' } })
    const result = await renderTree(g, Frame({ name: 'Bound', w: 100, h: 100, fill: vars.bg }))
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
    expect(node.fills[0]?.type).toBe('SOLID')
  })

  it('supports explicit variable bindings for supported paths', async () => {
    const g = makeSceneGraph()
    addTestColorVariable(g, 'var-shadow', 'Shadow', { r: 0, g: 0, b: 0, a: 1 })
    addTestColorVariable(g, 'var-bg', 'Background')
    const variable = designVar('var-shadow', '#000000')
    const result = await renderTree(
      g,
      Frame({
        name: 'Bound explicit',
        w: 100,
        h: 100,
        fill: '#ffffff',
        stroke: '#000000',
        bind: { 'strokes/0/color': variable, 'fills/0/color': 'var-bg' }
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['strokes/0/color']).toBe('var-shadow')
    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
  })

  it('binds variables from JSX strings', async () => {
    const g = makeSceneGraph()
    addTestColorVariable(g, 'var-bg', 'Background')
    const [result] = await renderJSX(
      g,
      `<Frame name="Bound JSX" w={100} h={100} fill={designVar('var-bg', '#ffffff')} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
    expect(node.fills[0]?.type).toBe('SOLID')
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

  it('handles auto-layout properties', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'Flex',
      flex: 'row',
      gap: 8,
      justify: 'between',
      items: 'center',
      wrap: true
    })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.layoutMode).toBe('HORIZONTAL')
    expect(node.itemSpacing).toBe(8)
    expect(node.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(node.counterAxisAlign).toBe('CENTER')
    expect(node.layoutWrap).toBe('WRAP')
  })

  it('justify/items without flex auto-enables auto-layout', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'IconBtn', w: 36, h: 36, justify: 'center', items: 'center' },
      Text({ size: 16, color: '#FFFFFF', children: '★' })
    )
    const result = await renderTree(g, tree)
    const n = getNodeOrThrow(g, result.id)

    expect(n.layoutMode).toBe('VERTICAL')
    expect(n.primaryAxisAlign).toBe('CENTER')
    expect(n.counterAxisAlign).toBe('CENTER')
  })

  it('handles padding shorthands', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Padded', px: 16, py: 8, pt: 4 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.paddingLeft).toBe(16)
    expect(node.paddingRight).toBe(16)
    expect(node.paddingBottom).toBe(8)
    expect(node.paddingTop).toBe(4) // pt overrides py
  })

  it('handles corner radius', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Rounded', rounded: 12 })
    const result = await renderTree(g, tree)
    expect(getNodeOrThrow(g, result.id).cornerRadius).toBe(12)
  })

  it('handles independent corners', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Corners', roundedTL: 8, roundedBR: 16 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.independentCorners).toBe(true)
    expect(node.topLeftRadius).toBe(8)
    expect(node.bottomRightRadius).toBe(16)
  })

  it('handles stroke', async () => {
    const g = makeSceneGraph()
    const tree = Rectangle({ name: 'Bordered', stroke: '#000', strokeWidth: 2 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.strokes.length).toBe(1)
    expect(expectDefined(node.strokes[0], 'first stroke').weight).toBe(2)
  })

  it('handles opacity and rotation', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Transformed', opacity: 0.5, rotate: 45 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.opacity).toBe(0.5)
    expect(node.rotation).toBe(45)
  })

  it('handles overflow hidden (clip)', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Clipped', overflow: 'hidden' })
    const result = await renderTree(g, tree)
    expect(getNodeOrThrow(g, result.id).clipsContent).toBe(true)
  })

  it('handles hug sizing', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Hug', w: 'hug', h: 'hug', flex: 'col' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.primaryAxisSizing).toBe('HUG')
    expect(node.counterAxisSizing).toBe('HUG')
  })

  it('handles fill sizing', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Fill', w: 'fill' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.layoutGrow).toBe(1)
  })

  it('handles shadow effect', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Shadow', shadow: '0 4 12 rgba(0,0,0,0.1)' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects.length).toBe(1)
    expect(expectDefined(node.effects[0], 'first effect').type).toBe('DROP_SHADOW')
    expect(expectDefined(node.effects[0], 'first effect').radius).toBe(12)
  })

  it('handles blur effect', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Blurred', blur: 8 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects.length).toBe(1)
    expect(expectDefined(node.effects[0], 'first effect').type).toBe('LAYER_BLUR')
    expect(expectDefined(node.effects[0], 'first effect').radius).toBe(8)
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

describe('renderTreeNode', () => {
  it('renders pre-built tree (browser path)', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'FromAI',
      w: 200,
      h: 100,
      bg: '#3B82F6',
      children: [Text({ name: 'Label', size: 16, color: '#FFF', children: 'Button' })]
    })
    const result = await renderTreeNode(g, tree)

    expect(result.name).toBe('FromAI')
    const node = getNodeOrThrow(g, result.id)
    expect(node.childIds.length).toBe(1)
    const label = getNodeOrThrow(g, childIdAt(node, 0))
    expect(label.text).toBe('Button')
  })
})

describe('renderJSX (string → scene graph)', () => {
  it('renders JSX string', async () => {
    const g = makeSceneGraph()
    const jsx = `
      <Frame name="Test" w={200} h={100} bg="#FF0000">
        <Text name="Hello" size={16} color="#000">World</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)

    expect(result.name).toBe('Test')
    const node = getNodeOrThrow(g, result.id)
    expect(node.type).toBe('FRAME')
    expect(node.childIds.length).toBe(1)

    const text = getNodeOrThrow(g, childIdAt(node, 0))
    expect(text.text).toBe('World')
  })

  it('renders nested JSX', async () => {
    const g = makeSceneGraph()
    const jsx = `
      <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
        <Rectangle name="Image" w={272} h={200} bg="#E5E7EB" rounded={12} />
        <Text name="Title" size={18} weight="bold" color="#111">Card Title</Text>
        <Text name="Description" size={14} color="#6B7280">Lorem ipsum</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    const card = getNodeOrThrow(g, result.id)

    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.childIds.length).toBe(3)
  })

  it('renders with position', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Frame name="At" w={50} h={50} />', { x: 100, y: 200 })
    const node = getNodeOrThrow(g, result.id)

    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
  })

  it('accepts rotation as an alias for rotate', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Rectangle name="Rotated" w={50} h={50} rotation={15} />')
    const node = getNodeOrThrow(g, result.id)

    expect(node.rotation).toBe(15)
  })

  it('strips HTML comments before JSX parsing', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      '<Frame name="Comments" w={50} h={50}><!-- generated note --><Text color="#000">Ok</Text></Frame>'
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.name).toBe('Comments')
    expect(node.childIds.length).toBe(1)
  })

  it('warns about unsupported props', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Frame name="Warn" w={50} h={50} mt={8} />')

    expect(result.warnings).toEqual(['Unsupported prop "mt" on <frame> is ignored.'])
  })

  it('accepts CSS-style layout aliases', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      '<Frame name="Aliases" w={200} h={100} flex="row" justifyContent="center" alignItems="center"><Rectangle w={20} h={20} /></Frame>'
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.primaryAxisAlign).toBe('CENTER')
    expect(node.counterAxisAlign).toBe('CENTER')
  })
})

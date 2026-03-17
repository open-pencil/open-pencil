import { describe, expect, it } from 'bun:test'

import {
  SceneGraph,
  renderTree,
  renderJSX,
  renderTreeNode,
  computeLayout,
  computeAllLayouts,
  sceneNodeToJSX,
  Frame,
  Text,
  Rectangle,
  Ellipse,
  Line,
  Star,
  Group,
  Section,
  isTreeNode,
  node
} from '@open-pencil/core'

function createGraph(): SceneGraph {
  const g = new SceneGraph()
  g.addPage('Test')
  return g
}

describe('TreeNode builders', () => {
  it('creates Frame tree node', () => {
    const tree = Frame({ name: 'Card', w: 320, h: 200, bg: '#FFF' })
    expect(isTreeNode(tree)).toBe(true)
    expect(tree.type).toBe('frame')
    expect(tree.props.name).toBe('Card')
    expect(tree.props.w).toBe(320)
    expect(tree.children).toEqual([])
  })

  it('creates Text tree node with string child', () => {
    const tree = Text({ name: 'Title', size: 18, children: 'Hello World' })
    expect(tree.type).toBe('text')
    expect(tree.children).toEqual(['Hello World'])
  })

  it('creates nested tree', () => {
    const tree = Frame({
      name: 'Card',
      children: [
        Rectangle({ name: 'Bg', w: 100, h: 100, bg: '#E5E7EB' }),
        Text({ name: 'Label', size: 14, children: 'Click me' })
      ]
    })
    expect(tree.children.length).toBe(2)
    expect(isTreeNode(tree.children[0]!)).toBe(true)
    const bg = tree.children[0] as ReturnType<typeof Rectangle>
    expect(bg.type).toBe('rectangle')
    expect(bg.props.name).toBe('Bg')
  })

  it('node() flattens nested arrays', () => {
    const tree = node('frame', {
      children: [[Text({ children: 'A' }), Text({ children: 'B' })], Text({ children: 'C' })]
    })
    expect(tree.children.length).toBe(3)
  })

  it('node() filters null/undefined children', () => {
    const tree = node('frame', {
      children: [null, Text({ children: 'A' }), undefined]
    })
    expect(tree.children.length).toBe(1)
  })
})

describe('renderTree', () => {
  it('renders a simple frame', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'MyFrame', w: 200, h: 100, bg: '#FF0000' })
    const result = await renderTree(g, tree)

    expect(result.name).toBe('MyFrame')
    expect(result.type).toBe('FRAME')

    const node = g.nodes.get(result.id)!
    expect(node.width).toBe(200)
    expect(node.height).toBe(100)
    expect(node.fills.length).toBe(1)
    expect(node.fills[0]!.type).toBe('SOLID')
  })

  it('renders text node with content', async () => {
    const g = createGraph()
    const tree = Text({ name: 'Heading', size: 24, weight: 'bold', color: '#111', children: 'Hello' })
    const result = await renderTree(g, tree)

    const node = g.nodes.get(result.id)!
    expect(node.type).toBe('TEXT')
    expect(node.text).toBe('Hello')
    expect(node.fontSize).toBe(24)
    expect(node.fontWeight).toBe(700)
    expect(node.fills.length).toBe(1)
  })

  it('renders nested structure', async () => {
    const g = createGraph()
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

    const card = g.nodes.get(result.id)!
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(16)
    expect(card.paddingTop).toBe(24)
    expect(card.paddingRight).toBe(24)
    expect(card.childIds.length).toBe(3)

    const title = g.nodes.get(card.childIds[1]!)!
    expect(title.text).toBe('Card Title')
    expect(title.fontWeight).toBe(700)
  })

  it('renders with position override', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Positioned', w: 100, h: 100 })
    const result = await renderTree(g, tree, { x: 50, y: 75 })

    const node = g.nodes.get(result.id)!
    expect(node.x).toBe(50)
    expect(node.y).toBe(75)
  })

  it('renders into a specific parent', async () => {
    const g = createGraph()
    const page = g.getPages()[0]!
    const container = g.createNode('FRAME', page.id, { name: 'Container' })

    const tree = Frame({ name: 'Child', w: 50, h: 50 })
    await renderTree(g, tree, { parentId: container.id })

    expect(container.childIds.length).toBe(1)
  })

  it('handles auto-layout properties', async () => {
    const g = createGraph()
    const tree = Frame({
      name: 'Flex',
      flex: 'row',
      gap: 8,
      justify: 'between',
      items: 'center',
      wrap: true
    })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.layoutMode).toBe('HORIZONTAL')
    expect(node.itemSpacing).toBe(8)
    expect(node.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(node.counterAxisAlign).toBe('CENTER')
    expect(node.layoutWrap).toBe('WRAP')
  })

  it('justify/items without flex auto-enables auto-layout', async () => {
    const g = createGraph()
    const tree = Frame(
      { name: 'IconBtn', w: 36, h: 36, justify: 'center', items: 'center' },
      Text({ size: 16, color: '#FFFFFF', children: '★' })
    )
    const result = await renderTree(g, tree)
    const n = g.nodes.get(result.id)!

    expect(n.layoutMode).toBe('VERTICAL')
    expect(n.primaryAxisAlign).toBe('CENTER')
    expect(n.counterAxisAlign).toBe('CENTER')
  })

  it('handles padding shorthands', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Padded', px: 16, py: 8, pt: 4 })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.paddingLeft).toBe(16)
    expect(node.paddingRight).toBe(16)
    expect(node.paddingBottom).toBe(8)
    expect(node.paddingTop).toBe(4) // pt overrides py
  })

  it('handles corner radius', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Rounded', rounded: 12 })
    const result = await renderTree(g, tree)
    expect(g.nodes.get(result.id)!.cornerRadius).toBe(12)
  })

  it('handles independent corners', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Corners', roundedTL: 8, roundedBR: 16 })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.independentCorners).toBe(true)
    expect(node.topLeftRadius).toBe(8)
    expect(node.bottomRightRadius).toBe(16)
  })

  it('handles stroke', async () => {
    const g = createGraph()
    const tree = Rectangle({ name: 'Bordered', stroke: '#000', strokeWidth: 2 })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.strokes.length).toBe(1)
    expect(node.strokes[0]!.weight).toBe(2)
  })

  it('handles opacity and rotation', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Transformed', opacity: 0.5, rotate: 45 })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.opacity).toBe(0.5)
    expect(node.rotation).toBe(45)
  })

  it('handles overflow hidden (clip)', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Clipped', overflow: 'hidden' })
    const result = await renderTree(g, tree)
    expect(g.nodes.get(result.id)!.clipsContent).toBe(true)
  })

  it('handles hug sizing', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Hug', w: 'hug', h: 'hug', flex: 'col' })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.primaryAxisSizing).toBe('HUG')
    expect(node.counterAxisSizing).toBe('HUG')
  })

  it('handles fill sizing', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Fill', w: 'fill' })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.layoutGrow).toBe(1)
  })

  it('handles shadow effect', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Shadow', shadow: '0 4 12 rgba(0,0,0,0.1)' })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.effects.length).toBe(1)
    expect(node.effects[0]!.type).toBe('DROP_SHADOW')
    expect(node.effects[0]!.radius).toBe(12)
  })

  it('handles blur effect', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Blurred', blur: 8 })
    const result = await renderTree(g, tree)
    const node = g.nodes.get(result.id)!

    expect(node.effects.length).toBe(1)
    expect(node.effects[0]!.type).toBe('LAYER_BLUR')
    expect(node.effects[0]!.radius).toBe(8)
  })

  it('renders all primitive types', async () => {
    const g = createGraph()
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
      expect(g.nodes.get(result.id)!.type).toBe(expected)
    }
  })

  it('throws on unknown element type', () => {
    const g = createGraph()
    const tree = { type: 'foobar', props: {}, children: [] }
    expect(() => renderTree(g, tree)).toThrow('Unknown element: <foobar>')
  })
})

describe('renderTreeNode', () => {
  it('renders pre-built tree (browser path)', async () => {
    const g = createGraph()
    const tree = Frame({
      name: 'FromAI',
      w: 200,
      h: 100,
      bg: '#3B82F6',
      children: [Text({ name: 'Label', size: 16, color: '#FFF', children: 'Button' })]
    })
    const result = await renderTreeNode(g, tree)

    expect(result.name).toBe('FromAI')
    const node = g.nodes.get(result.id)!
    expect(node.childIds.length).toBe(1)
    const label = g.nodes.get(node.childIds[0]!)!
    expect(label.text).toBe('Button')
  })
})

describe('renderJSX (string → scene graph)', () => {
  it('renders JSX string', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="Test" w={200} h={100} bg="#FF0000">
        <Text name="Hello" size={16} color="#000">World</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)

    expect(result.name).toBe('Test')
    const node = g.nodes.get(result.id)!
    expect(node.type).toBe('FRAME')
    expect(node.childIds.length).toBe(1)

    const text = g.nodes.get(node.childIds[0]!)!
    expect(text.text).toBe('World')
  })

  it('renders nested JSX', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
        <Rectangle name="Image" w={272} h={200} bg="#E5E7EB" rounded={12} />
        <Text name="Title" size={18} weight="bold" color="#111">Card Title</Text>
        <Text name="Description" size={14} color="#6B7280">Lorem ipsum</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    const card = g.nodes.get(result.id)!

    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.childIds.length).toBe(3)
  })

  it('renders with position', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Frame name="At" w={50} h={50} />', { x: 100, y: 200 })
    const node = g.nodes.get(result.id)!

    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
  })

  it('renders multiple root elements', async () => {
    const g = createGraph()
    const results = await renderJSX(g, '<Rectangle name="A" w={10} h={10} />\n\n<Ellipse name="B" w={20} h={20} />')

    expect(results.length).toBe(2)
    expect(results[0].name).toBe('A')
    expect(results[0].type).toBe('RECTANGLE')
    expect(results[1].name).toBe('B')
    expect(results[1].type).toBe('ELLIPSE')
  })

  it('renders Component tag', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Component name="Btn" w={100} h={40} />')

    expect(result.name).toBe('Btn')
    expect(result.type).toBe('COMPONENT')
  })
})

describe('grid layout rendering', () => {
  it('creates grid frame with template columns', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50 }),
      Rectangle({ name: 'B', w: 50, h: 50 }),
      Rectangle({ name: 'C', w: 50, h: 50 })
    )
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.layoutMode).toBe('GRID')
    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('creates grid frame with mixed track sizes', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 400, h: 200, grid: true, columns: '100 1fr 2fr' })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FIXED', value: 100 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 2 }
    ])
  })

  it('creates grid with numeric columns shorthand', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: 3 })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('sets grid gaps', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr', columnGap: 10, rowGap: 20 })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.gridColumnGap).toBe(10)
    expect(frame.gridRowGap).toBe(20)
  })

  it('sets grid gap shorthand', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr', gap: 16 })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.gridColumnGap).toBe(16)
    expect(frame.gridRowGap).toBe(16)
  })

  it('applies grid padding', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr', p: 10 })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.paddingTop).toBe(10)
    expect(frame.paddingRight).toBe(10)
    expect(frame.paddingBottom).toBe(10)
    expect(frame.paddingLeft).toBe(10)
  })

  it('sets grid rows', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr', rows: '100 1fr' })
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!

    expect(frame.gridTemplateRows).toEqual([
      { sizing: 'FIXED', value: 100 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('sets grid child position', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50, colStart: 2, rowStart: 1 })
    )
    const result = await renderTree(g, tree)
    const children = g.getChildren(result.id)

    expect(children[0].gridPosition).toEqual({ column: 2, row: 1, columnSpan: 1, rowSpan: 1 })
  })

  it('sets grid child span', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50, colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2 })
    )
    const result = await renderTree(g, tree)
    const children = g.getChildren(result.id)

    expect(children[0].gridPosition).toEqual({ column: 1, row: 1, columnSpan: 2, rowSpan: 2 })
  })

  it('grid + computeLayout positions children in cells', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr' },
      Rectangle({ name: 'A', w: 50, h: 50 }),
      Rectangle({ name: 'B', w: 50, h: 50 }),
      Rectangle({ name: 'C', w: 50, h: 50 })
    )
    const result = await renderTree(g, tree)
    computeLayout(g, result.id)

    const children = g.getChildren(result.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(100)
    expect(children[2].x).toBe(200)
  })

  it('grid 2x2 with gap positions correctly', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 210, h: 210, grid: true, columns: '1fr 1fr', rows: '1fr 1fr', gap: 10 },
      Rectangle({ name: 'A', w: 30, h: 30 }),
      Rectangle({ name: 'B', w: 30, h: 30 }),
      Rectangle({ name: 'C', w: 30, h: 30 }),
      Rectangle({ name: 'D', w: 30, h: 30 })
    )
    const result = await renderTree(g, tree)
    computeLayout(g, result.id)

    const children = g.getChildren(result.id)
    expect(children[0].x).toBe(0)
    expect(children[0].y).toBe(0)
    expect(children[1].x).toBe(110)
    expect(children[1].y).toBe(0)
    expect(children[2].x).toBe(0)
    expect(children[2].y).toBe(110)
    expect(children[3].x).toBe(110)
    expect(children[3].y).toBe(110)
  })

  it('renders grid from JSX string', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="Grid" w={300} h={100} grid columns="1fr 1fr" gap={10}>
        <Rectangle name="A" w={50} h={50} />
        <Rectangle name="B" w={50} h={50} />
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    const frame = g.nodes.get(result.id)!

    expect(frame.layoutMode).toBe('GRID')
    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 }
    ])
    expect(frame.gridColumnGap).toBe(10)
    expect(frame.gridRowGap).toBe(10)

    computeLayout(g, result.id)
    const children = g.getChildren(result.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(155)
  })

  it('grid auto-height (no rows) grows to fit content', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, grid: true, columns: '1fr 1fr', gap: 10 },
      Rectangle({ name: 'A', w: 50, h: 80 }),
      Rectangle({ name: 'B', w: 50, h: 80 }),
      Rectangle({ name: 'C', w: 50, h: 60 }),
      Rectangle({ name: 'D', w: 50, h: 60 })
    )
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!
    expect(frame.gridTemplateRows).toEqual([])

    computeLayout(g, result.id)
    const updated = g.nodes.get(result.id)!
    expect(updated.height).toBe(150)
  })

  it('grid children with flex stretch to cell width', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 200, grid: true, columns: '1fr 1fr', gap: 0 },
      Frame({ name: 'A', flex: 'col', gap: 4, p: 8, children: [
        Rectangle({ name: 'R1', w: 10, h: 20 })
      ]}),
      Frame({ name: 'B', flex: 'col', gap: 4, p: 8, children: [
        Rectangle({ name: 'R2', w: 10, h: 20 })
      ]})
    )
    const result = await renderTree(g, tree)
    computeAllLayouts(g)

    const children = g.getChildren(result.id)
    expect(children[0].width).toBe(100)
    expect(children[1].width).toBe(100)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(100)
  })

  it('grid prop takes precedence over padding-triggered auto-layout', async () => {
    const g = createGraph()
    const tree = Frame({ name: 'Grid', w: 300, grid: true, columns: '1fr 1fr', p: 20 },
      Rectangle({ name: 'A', w: 50, h: 50 }),
      Rectangle({ name: 'B', w: 50, h: 50 })
    )
    const result = await renderTree(g, tree)
    const frame = g.nodes.get(result.id)!
    expect(frame.layoutMode).toBe('GRID')
  })

  it('grid w=fill stretches in flex-col parent', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="P" flex="col" w={400} p={20}>
        <Frame name="G" grid columns="1fr 1fr" gap={10} w="fill">
          <Rectangle w={10} h={30} />
          <Rectangle w={10} h={30} />
        </Frame>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    computeAllLayouts(g)
    const grid = g.getChildren(result.id).find(c => c.name === 'G')!
    expect(grid.width).toBe(360)
    expect(grid.layoutMode).toBe('GRID')
  })

  it('grid grow=1 fills remaining space in flex-row', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="P" flex="row" w={500} p={20} gap={10}>
        <Rectangle w={100} h={50} />
        <Frame name="G" grid columns="1fr 1fr" gap={10} grow={1}>
          <Rectangle w={10} h={30} />
          <Rectangle w={10} h={30} />
        </Frame>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    computeAllLayouts(g)
    const grid = g.getChildren(result.id).find(c => c.name === 'G')!
    expect(grid.width).toBe(350)
  })

  it('nested flex > flex > grid: grid stretches to correct width', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="Card" flex="col" w={780}>
        <Frame name="Content" flex="col" w="fill" p={28}>
          <Frame name="G" grid columns="1fr 1fr 1fr" w="fill" columnGap={16}>
            <Rectangle w={10} h={30} />
            <Rectangle w={10} h={30} />
            <Rectangle w={10} h={30} />
          </Frame>
        </Frame>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    computeAllLayouts(g)
    const content = g.getChildren(result.id).find(c => c.name === 'Content')!
    const grid = g.getChildren(content.id).find(c => c.name === 'G')!
    expect(content.width).toBe(780)
    expect(grid.width).toBe(724)
  })

  it('grid h=fill grows in flex-col parent', async () => {
    const g = createGraph()
    const jsx = `
      <Frame name="P" flex="col" w={400} h={600} p={20}>
        <Rectangle w={360} h={100} />
        <Frame name="G" grid columns="1fr 1fr" gap={10} h="fill">
          <Rectangle w={10} h={30} />
          <Rectangle w={10} h={30} />
        </Frame>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    computeAllLayouts(g)
    const grid = g.getChildren(result.id).find(c => c.name === 'G')!
    expect(grid.height).toBe(460)
  })
})

describe('text props round-trip', () => {
  it('lineHeight renders and exports', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" lineHeight={24}>Hello</Text>')
    const n = g.getNode(result.id)!
    expect(n.lineHeight).toBe(24)
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('lineHeight={24}')
  })

  it('letterSpacing renders and exports', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" letterSpacing={2}>Spaced</Text>')
    const n = g.getNode(result.id)!
    expect(n.letterSpacing).toBe(2)
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('letterSpacing={2}')
  })

  it('textDecoration renders and exports', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" textDecoration="underline">Link</Text>')
    const n = g.getNode(result.id)!
    expect(n.textDecoration).toBe('UNDERLINE')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('textDecoration="underline"')
  })

  it('textCase renders and exports', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" textCase="upper">label</Text>')
    const n = g.getNode(result.id)!
    expect(n.textCase).toBe('UPPER')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('textCase="upper"')
  })

  it('maxLines renders with truncation', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" maxLines={2}>Long text here</Text>')
    const n = g.getNode(result.id)!
    expect(n.maxLines).toBe(2)
    expect(n.textTruncation).toBe('ENDING')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('maxLines={2}')
  })

  it('truncate without maxLines', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000" truncate>Overflow</Text>')
    const n = g.getNode(result.id)!
    expect(n.textTruncation).toBe('ENDING')
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).toContain('truncate')
  })

  it('defaults omit text props', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, '<Text color="#000">Plain</Text>')
    const n = g.getNode(result.id)!
    expect(n.lineHeight).toBeNull()
    expect(n.letterSpacing).toBe(0)
    expect(n.textDecoration).toBe('NONE')
    expect(n.textCase).toBe('ORIGINAL')
    expect(n.maxLines).toBeNull()
    const jsx = sceneNodeToJSX(n.id, g)
    expect(jsx).not.toContain('lineHeight')
    expect(jsx).not.toContain('letterSpacing')
    expect(jsx).not.toContain('textDecoration')
    expect(jsx).not.toContain('textCase')
    expect(jsx).not.toContain('maxLines')
    expect(jsx).not.toContain('truncate')
  })

  it('text w="fill" in flex="col" exports as w="fill" not w={computed}', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, `
      <Frame name="Card" flex="col" w={300} p={20}>
        <Text name="Title" size={22} weight="bold" color="#111" w="fill">Hello World</Text>
      </Frame>
    `)
    const card = g.getNode(result.id)!
    const title = g.getNode(card.childIds[0]!)!
    expect(title.layoutAlignSelf).toBe('STRETCH')
    expect(title.textAutoResize).toBe('HEIGHT')
    const jsx = sceneNodeToJSX(title.id, g)
    expect(jsx).toContain('w="fill"')
    expect(jsx).not.toMatch(/w=\{/)
  })

  it('text grow={1} in flex="row" exports as grow not w={computed}', async () => {
    const g = createGraph()
    const [result] = await renderJSX(g, `
      <Frame name="Row" flex="row" w={300}>
        <Text name="Label" color="#999" w={60}>Label</Text>
        <Text name="Value" color="#111" w="fill">Some value text</Text>
      </Frame>
    `)
    const row = g.getNode(result.id)!
    const value = g.getNode(row.childIds[1]!)!
    expect(value.layoutGrow).toBe(1)
    const jsx = sceneNodeToJSX(value.id, g)
    expect(jsx).toContain('grow={1}')
    expect(jsx).not.toMatch(/\bw=\{\d+\}/)
  })
})

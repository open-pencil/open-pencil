import { describe, expect, it } from 'bun:test'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

import {
  renderTree,
  renderJSX,
  computeLayout,
  computeAllLayouts,
  Frame,
  Rectangle
} from '@open-pencil/core'

describe('grid layout rendering', () => {
  it('creates grid frame with template columns', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50 }),
      Rectangle({ name: 'B', w: 50, h: 50 }),
      Rectangle({ name: 'C', w: 50, h: 50 })
    )
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.layoutMode).toBe('GRID')
    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('creates grid frame with mixed track sizes', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Grid', w: 400, h: 200, grid: true, columns: '100 1fr 2fr' })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FIXED', value: 100 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 2 }
    ])
  })

  it('creates grid with numeric columns shorthand', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: 3 })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.gridTemplateColumns).toEqual([
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('sets grid gaps', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'Grid',
      w: 300,
      h: 200,
      grid: true,
      columns: '1fr 1fr',
      columnGap: 10,
      rowGap: 20
    })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.gridColumnGap).toBe(10)
    expect(frame.gridRowGap).toBe(20)
  })

  it('sets grid gap shorthand', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr', gap: 16 })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.gridColumnGap).toBe(16)
    expect(frame.gridRowGap).toBe(16)
  })

  it('applies grid padding', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr', p: 10 })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.paddingTop).toBe(10)
    expect(frame.paddingRight).toBe(10)
    expect(frame.paddingBottom).toBe(10)
    expect(frame.paddingLeft).toBe(10)
  })

  it('sets grid rows', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'Grid',
      w: 300,
      h: 200,
      grid: true,
      columns: '1fr',
      rows: '100 1fr'
    })
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)

    expect(frame.gridTemplateRows).toEqual([
      { sizing: 'FIXED', value: 100 },
      { sizing: 'FR', value: 1 }
    ])
  })

  it('sets grid child position', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50, colStart: 2, rowStart: 1 })
    )
    const result = await renderTree(g, tree)
    const children = g.getChildren(result.id)

    expect(children[0].gridPosition).toEqual({ column: 2, row: 1, columnSpan: 1, rowSpan: 1 })
  })

  it('sets grid child span', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr 1fr' },
      Rectangle({ name: 'A', w: 50, h: 50, colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2 })
    )
    const result = await renderTree(g, tree)
    const children = g.getChildren(result.id)

    expect(children[0].gridPosition).toEqual({ column: 1, row: 1, columnSpan: 2, rowSpan: 2 })
  })

  it('grid + computeLayout positions children in cells', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, h: 200, grid: true, columns: '1fr 1fr 1fr', rows: '1fr' },
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
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 210, h: 210, grid: true, columns: '1fr 1fr', rows: '1fr 1fr', gap: 10 },
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
    const g = makeSceneGraph()
    const jsx = `
      <Frame name="Grid" w={300} h={100} grid columns="1fr 1fr" gap={10}>
        <Rectangle name="A" w={50} h={50} />
        <Rectangle name="B" w={50} h={50} />
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    const frame = getNodeOrThrow(g, result.id)

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
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, grid: true, columns: '1fr 1fr', gap: 10 },
      Rectangle({ name: 'A', w: 50, h: 80 }),
      Rectangle({ name: 'B', w: 50, h: 80 }),
      Rectangle({ name: 'C', w: 50, h: 60 }),
      Rectangle({ name: 'D', w: 50, h: 60 })
    )
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)
    expect(frame.gridTemplateRows).toEqual([])

    computeLayout(g, result.id)
    const updated = getNodeOrThrow(g, result.id)
    expect(updated.height).toBe(150)
  })

  it('grid children with flex stretch to cell width', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 200, grid: true, columns: '1fr 1fr', gap: 0 },
      Frame({
        name: 'A',
        flex: 'col',
        gap: 4,
        p: 8,
        children: [Rectangle({ name: 'R1', w: 10, h: 20 })]
      }),
      Frame({
        name: 'B',
        flex: 'col',
        gap: 4,
        p: 8,
        children: [Rectangle({ name: 'R2', w: 10, h: 20 })]
      })
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
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'Grid', w: 300, grid: true, columns: '1fr 1fr', p: 20 },
      Rectangle({ name: 'A', w: 50, h: 50 }),
      Rectangle({ name: 'B', w: 50, h: 50 })
    )
    const result = await renderTree(g, tree)
    const frame = getNodeOrThrow(g, result.id)
    expect(frame.layoutMode).toBe('GRID')
  })

  it('grid w=fill stretches in flex-col parent', async () => {
    const g = makeSceneGraph()
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
    const grid = expectDefined(
      g.getChildren(result.id).find((c) => c.name === 'G'),
      'grid node'
    )
    expect(grid.width).toBe(360)
    expect(grid.layoutMode).toBe('GRID')
  })

  it('grid grow=1 fills remaining space in flex-row', async () => {
    const g = makeSceneGraph()
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
    const grid = expectDefined(
      g.getChildren(result.id).find((c) => c.name === 'G'),
      'grid node'
    )
    expect(grid.width).toBe(350)
  })

  it('nested flex > flex > grid: grid stretches to correct width', async () => {
    const g = makeSceneGraph()
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
    const content = expectDefined(
      g.getChildren(result.id).find((c) => c.name === 'Content'),
      'content node'
    )
    const grid = expectDefined(
      g.getChildren(content.id).find((c) => c.name === 'G'),
      'grid node'
    )
    expect(content.width).toBe(780)
    expect(grid.width).toBe(724)
  })

  it('grid h=fill grows in flex-col parent', async () => {
    const g = makeSceneGraph()
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
    const grid = expectDefined(
      g.getChildren(result.id).find((c) => c.name === 'G'),
      'grid node'
    )
    expect(grid.height).toBe(460)
  })
})

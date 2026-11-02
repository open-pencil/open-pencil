import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { ALL_TOOLS, isToolExposed } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'
import { pixelLength } from '@lawha/scene-graph/text'

import { NEAR_DUPLICATE } from '#core/design-system/plan'

function tool(name: string) {
  const found = ALL_TOOLS.find((item) => item.name === name)
  if (!found) throw new Error(`No tool ${name}`)
  return (figma: FigmaAPI, args: Record<string, unknown>) => found.execute(figma, args)
}
const build = tool('build_design_system')

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('expected a value')
  return value
}

const hex = (h: string) => ({
  r: Number.parseInt(h.slice(1, 3), 16) / 255,
  g: Number.parseInt(h.slice(3, 5), 16) / 255,
  b: Number.parseInt(h.slice(5, 7), 16) / 255,
  a: 1
})
const fill = (h: string) => [{ type: 'SOLID' as const, color: hex(h), opacity: 1, visible: true }]

interface Summary {
  colors: { name: string; uses: number; variants: string[] }[]
  type: { name: string; size: number; weight: number; uses: number }[]
  families: { name: string; family: string }[]
  spacing: { name: string; value: number }[]
  radius: { name: string; value: number }[]
}
interface Built extends Summary {
  collection: string
  variables: { created: number; updated: number }
  bound: number
  normalized: number
  inconsistencies: { token: string; variants: string[] }[]
  docsPage: string | null
}

/** Two screens: white backgrounds, indigo buttons, dark and grey text, 32/16/12 type. */
function design() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const nodes: Record<string, string> = {}
  const text = (parent: string, name: string, size: number, weight: number, color: string) =>
    graph.createNode('TEXT', parent, {
      name,
      text: name,
      fontFamily: 'Inter',
      fontSize: size,
      fontWeight: weight,
      lineHeight: pixelLength(Math.round(size * 1.5)),
      fills: fill(color)
    }).id
  for (const [i, name] of ['Home', 'Details'].entries()) {
    const screen = graph.createNode('FRAME', page, {
      name,
      x: i * 500,
      width: 390,
      height: 844,
      fills: fill('#FFFFFF'),
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 24
    })
    nodes[name] = screen.id
    nodes[`${name}/title`] = text(screen.id, `${name} title`, 32, 700, '#111111')
    for (let k = 0; k < 3; k++) text(screen.id, `${name} body ${k}`, 16, 400, '#111111')
    text(screen.id, `${name} caption`, 12, 400, '#6B7280')
    const button = graph.createNode('FRAME', screen.id, {
      name: 'Button',
      width: 342,
      height: 52,
      cornerRadius: 8,
      fills: fill(i === 0 ? '#4F46E5' : '#4F46E5')
    })
    nodes[`${name}/button`] = button.id
    const card = graph.createNode('FRAME', screen.id, {
      name: 'Card',
      width: 342,
      height: 120,
      cornerRadius: 16,
      fills: fill('#F3F4F6')
    })
    nodes[`${name}/card`] = card.id
  }
  // A third primary use, and one hand-typed near-duplicate of it.
  nodes.badge = graph.createNode('RECTANGLE', nodes.Home, {
    name: 'Badge',
    width: 20,
    height: 20,
    cornerRadius: 999,
    fills: fill('#4F46E5')
  }).id
  nodes.offBrand = graph.createNode('RECTANGLE', nodes.Details, {
    name: 'Off-brand',
    width: 20,
    height: 20,
    fills: fill('#4F46E6')
  }).id
  const figma = new FigmaAPI(graph)
  return { figma, graph, nodes }
}

const byName = <T extends { name: string }>(list: T[], name: string) =>
  must(list.find((x) => x.name === name))

describe('planning tokens', () => {
  test('names colours by role', () => {
    const { figma } = design()
    const out = build(figma, { dry_run: true }) as Summary
    expect(out.colors.map((c) => c.name).sort()).toEqual(
      [
        'color/background',
        'color/neutral/50',
        'color/primary',
        'color/text/primary',
        'color/text/secondary'
      ].sort()
    )
    expect(byName(out.colors, 'color/primary')).toMatchObject({ uses: 3, variants: ['#4F46E6'] })
    expect(byName(out.colors, 'color/text/primary').uses).toBe(8)
  })

  test('names type by size and use: the most used is body', () => {
    const { figma } = design()
    const out = build(figma, { dry_run: true }) as Summary
    expect(out.type.map((t) => [t.name, t.size, t.weight])).toEqual([
      ['h1', 32, 700],
      ['body', 16, 400],
      ['caption', 12, 400]
    ])
    expect(out.families).toEqual([{ name: 'font/primary', family: 'Inter' }])
  })

  test('spacing and radius scales, sorted, with full for pills', () => {
    const { figma } = design()
    const out = build(figma, { dry_run: true }) as Summary
    expect(out.spacing.map((s) => s.name)).toEqual(['space/16', 'space/24'])
    expect(out.radius.map((r) => r.name)).toEqual(['radius/8', 'radius/16', 'radius/full'])
  })

  test('the near-duplicate threshold separates hand-typed copies from real colours', () => {
    expect(NEAR_DUPLICATE).toBeGreaterThan(1)
    expect(NEAR_DUPLICATE).toBeLessThan(20)
  })

  test('dry run changes nothing', () => {
    const { figma, graph } = design()
    build(figma, { dry_run: true })
    expect(graph.variables.size).toBe(0)
    expect(graph.getPages()).toHaveLength(1)
  })
})

describe('building', () => {
  test('creates the variables with the right values and binds every use', () => {
    const { figma, graph, nodes } = design()
    const out = build(figma, {}) as Built
    const vars = [...graph.variables.values()]
    const named = (name: string) => must(vars.find((v) => v.name === name))
    expect(out.variables.created).toBe(vars.length)
    expect(Object.values(named('color/primary').valuesByMode)[0]).toMatchObject(hex('#4F46E5'))
    expect(Object.values(named('space/24').valuesByMode)[0]).toBe(24)
    expect(Object.values(named('font/primary').valuesByMode)[0]).toBe('Inter')
    // The buttons, the badge and the title all point at their variables now.
    expect(must(graph.getNode(nodes['Home/button'])).boundVariables['fills/0/color']).toBe(
      named('color/primary').id
    )
    expect(must(graph.getNode(nodes['Home/button'])).boundVariables.cornerRadius).toBe(
      named('radius/8').id
    )
    expect(must(graph.getNode(nodes['Home/title'])).boundVariables.fontSize).toBe(
      named('type/h1/size').id
    )
    expect(must(graph.getNode(nodes['Home/title'])).boundVariables.fontFamily).toBe(
      named('font/primary').id
    )
    expect(must(graph.getNode(nodes.Home)).boundVariables.paddingLeft).toBe(named('space/24').id)
    expect(must(graph.getNode(nodes.Home)).boundVariables.itemSpacing).toBe(named('space/16').id)
    expect(out.bound).toBeGreaterThan(30)
  })

  test('a near-duplicate is reported and left alone unless normalising', () => {
    const plain = design()
    const out = build(plain.figma, {}) as Built
    expect(out.inconsistencies).toEqual([{ token: 'color/primary', variants: ['#4F46E6'] }])
    expect(
      must(plain.graph.getNode(plain.nodes.offBrand)).boundVariables['fills/0/color']
    ).toBeUndefined()
    const fixed = design()
    const normalized = build(fixed.figma, { normalize: true }) as Built
    expect(normalized.normalized).toBe(1)
    expect(
      must(fixed.graph.getNode(fixed.nodes.offBrand)).boundVariables['fills/0/color']
    ).toBeDefined()
  })

  test('apply: false creates the variables without touching layers', () => {
    const { figma, graph, nodes } = design()
    const out = build(figma, { apply: false }) as Built
    expect(out.bound).toBe(0)
    expect(graph.variables.size).toBeGreaterThan(0)
    expect(must(graph.getNode(nodes['Home/button'])).boundVariables).toEqual({})
  })

  test('building again reuses the collection, variables and page', () => {
    const { figma, graph } = design()
    const first = build(figma, { apply: false }) as Built
    const count = graph.variables.size
    const docs = must(graph.getNode(must(first.docsPage)))
    const children = docs.childIds.length
    const second = build(figma, { apply: false }) as Built
    expect(second.variables.created).toBe(0)
    expect(second.variables.updated).toBe(count)
    expect(graph.variables.size).toBe(count)
    expect(graph.variableCollections.size).toBe(1)
    expect(graph.getPages().filter((p) => p.name === 'Design System')).toHaveLength(1)
    expect(must(graph.getNode(must(second.docsPage))).childIds).toHaveLength(children)
  })

  test('the docs page shows bound swatches, type samples and the scales', () => {
    const { figma, graph } = design()
    const out = build(figma, {}) as Built
    const page = must(graph.getNode(must(out.docsPage)))
    const sections = page.childIds.map((id) => must(graph.getNode(id)).name)
    expect(sections).toEqual(['Colors', 'Typography', 'Spacing & radius'])
    const colors = must(graph.getNode(page.childIds[0]))
    const swatch = must(
      colors.childIds.map((id) => must(graph.getNode(id))).find((n) => n.name === 'color/primary')
    )
    const primary = must([...graph.variables.values()].find((v) => v.name === 'color/primary'))
    expect(swatch.boundVariables['fills/0/color']).toBe(primary.id)
  })

  test('scope selection reads only the selected layers', () => {
    const { figma, nodes } = design()
    figma.currentPage.selection = [must(figma.getNodeById(nodes['Home/card']))]
    const out = build(figma, { scope: 'selection', dry_run: true }) as Summary
    expect(out.colors.map((c) => c.name)).toEqual(['color/background'])
    expect(out.radius.map((r) => r.value)).toEqual([16])
  })

  test('refuses an empty page, an empty selection and the docs page itself', () => {
    expect(build(new FigmaAPI(new SceneGraph()), {})).toMatchObject({ error: expect.any(String) })
    const { figma } = design()
    figma.currentPage.selection = []
    expect(build(figma, { scope: 'selection' })).toMatchObject({ error: expect.any(String) })
    const out = build(figma, { apply: false }) as Built
    figma.currentPage = must(figma.getNodeById(must(out.docsPage)))
    expect(build(figma, {})).toMatchObject({ error: expect.stringContaining('Design System') })
  })
})

test('build_design_system reaches AI chat and MCP', () => {
  const def = must(ALL_TOOLS.find((t) => t.name === 'build_design_system'))
  expect(isToolExposed(def, 'mcp') && isToolExposed(def, 'ai')).toBe(true)
})

test('editing a variable restyles every layer bound to it', () => {
  const { figma, graph, nodes } = design()
  build(figma, {})
  const primary = must(figma.variables.getLocalVariables().find((v) => v.name === 'color/primary'))
  const red = { r: 1, g: 0, b: 0, a: 1 }
  for (const modeId of Object.keys(primary.valuesByMode)) primary.setValueForMode(modeId, red)
  for (const id of [nodes['Home/button'], nodes['Details/button'], nodes.badge]) {
    const fills = must(figma.getNodeById(id)).fills as readonly {
      color: { r: number; g: number; b: number }
    }[]
    expect(fills[0].color).toMatchObject({ r: 1, g: 0, b: 0 })
  }
  // The unbound near-duplicate keeps its own colour.
  const off = must(graph.getNode(nodes.offBrand)).fills[0].color
  expect(off.r).toBeCloseTo(0x4f / 255, 5)
})

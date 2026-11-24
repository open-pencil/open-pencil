import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

const THEME = `
  :root { --primary: #112233; --surface: #ffffff; --line: var(--primary); --radius: 8px; --scaled: calc(var(--radius) * 2) }
  .dark { --primary: #ddeeff; --surface: #000000 }
  button { display: flex; border: 1px solid transparent; border-radius: var(--radius); background: var(--primary); color: var(--surface) }
  button:hover { background: color-mix(in srgb, var(--primary) 50%, transparent) }
  button:focus-visible { border-color: var(--line); box-shadow: 0 0 #0000, 0 0 0 3px var(--primary) }
  .dark button.outline { border-color: var(--line) }
  div:has(> em) { opacity: 0.5 }
`

const VARIABLES = {
  collection: 'Theme',
  modes: [{ name: 'Light' }, { name: 'Dark', rootAttributes: { class: 'dark' } }]
}

const button = (state: string, forced = '', className = '') =>
  `<button data-op-component="State=${state}" data-force-state="${forced}" class="${className}"><span data-op-text="Label">Save</span></button>`

const KIT = `<div data-op-component-set="Button">${button('Rest')}${button('Hover', 'hover')}${button('Focus', 'focus-visible')}${button('Outline', '', 'outline')}</div>
  <section data-op-component="Card" style="padding:8px;background:var(--surface)"><div data-op-slot="Content" style="padding:4px"><p data-op-visible="Hint">Hi</p></div></section>`

async function kit() {
  const { graph } = await readHTMLDocument(KIT, {
    cssText: THEME,
    variables: VARIABLES,
    components: true
  })
  return graph
}

function named(graph: SceneGraph, name: string): SceneNode {
  const node = [...graph.getAllNodes()].find((candidate) => candidate.name === name)
  if (!node) throw new Error(`No ${name}`)
  return node
}

function bound(graph: SceneGraph, node: SceneNode, field: string): string | undefined {
  const id = node.boundVariables[field]
  return id ? graph.variables.get(id)?.name : undefined
}

function values(graph: SceneGraph, name: string) {
  const variable = [...graph.variables.values()].find((candidate) => candidate.name === name)
  if (!variable) throw new Error(`No variable ${name}`)
  const [collection] = graph.variableCollections.values()
  return collection.modes.map(({ modeId }) => variable.valuesByMode[modeId])
}

describe('variables from custom properties', () => {
  test('hold each mode, keep aliases, and resolve calc()', async () => {
    const graph = await kit()
    const [collection] = graph.variableCollections.values()
    expect(collection.modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
    expect(values(graph, 'surface')).toEqual([
      { r: 1, g: 1, b: 1, a: 1 },
      { r: 0, g: 0, b: 0, a: 1 }
    ])
    const primary = [...graph.variables.values()].find(({ name }) => name === 'primary')
    if (!primary) throw new Error('No variable primary')
    expect(values(graph, 'line')).toEqual([{ aliasId: primary.id }, { aliasId: primary.id }])
    expect(values(graph, 'scaled')).toEqual([16, 16])
  })

  test('bind the paints, radii, and shadows that name them', async () => {
    const graph = await kit()
    const rest = named(graph, 'State=Rest')
    expect(bound(graph, rest, 'fills/0/color')).toBe('primary')
    expect(bound(graph, rest, 'topLeftRadius')).toBe('radius')
    const [label] = graph.getChildren(rest.id)
    expect(bound(graph, label, 'fills/0/color')).toBe('surface')
    const focus = named(graph, 'State=Focus')
    expect(bound(graph, focus, 'strokes/0/color')).toBe('line')
    expect(bound(graph, focus, 'effects/0/color')).toBe('primary')
  })

  test('are made for a translucent color, and for one that is transparent in a mode', async () => {
    const graph = await kit()
    expect(bound(graph, named(graph, 'State=Hover'), 'fills/0/color')).toBe('primary 50%')
    expect(values(graph, 'primary 50%')).toMatchObject([{ a: 0.5 }, { a: 0.5 }])
    const outline = named(graph, 'State=Outline')
    expect(bound(graph, outline, 'strokes/0/color')).toBe('transparent | line')
    expect(outline.strokes[0].opacity).toBe(0)
  })

  test('give every layer the colors the page has in another mode', async () => {
    const graph = await kit()
    const dark = await readHTMLDocument(KIT, {
      cssText: THEME,
      variables: { ...VARIABLES, modes: VARIABLES.modes.toReversed() },
      components: true
    })
    const [{ id, modes }] = graph.variableCollections.values()
    const darkMode = modes[1].modeId
    const [page] = graph.getPages()
    graph.updateNode(page.id, { variableModes: { [id]: darkMode } })
    for (const state of ['Rest', 'Hover', 'Focus', 'Outline']) {
      const node = named(graph, `State=${state}`)
      const expected = named(dark.graph, `State=${state}`)
      const paints = (layer: SceneNode) =>
        [...layer.fills, ...layer.strokes].map(({ color, opacity }) =>
          [color.r, color.g, color.b, opacity].map((part) => Math.round(part * 255))
        )
      const shown = (layer: SceneNode) =>
        paints(layer).map((paint, index) => {
          const field =
            index < layer.fills.length
              ? `fills/${index}/color`
              : `strokes/${index - layer.fills.length}/color`
          const color = graph.resolveColorVariableForNode(layer.id, layer.boundVariables[field])
          if (!color) return paint
          return [color.r, color.g, color.b, color.a].map((part) => Math.round(part * 255))
        })
      // A fully transparent paint draws nothing, whether or not the layer holds one.
      const drawn = (list: number[][]) => list.filter(([, , , alpha]) => alpha > 0)
      expect(drawn(shown(node))).toEqual(drawn(paints(expected)))
    }
  })

  test('leave a property set nearer than the root unbound', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="own" style="--primary:red;width:9px;height:9px;background:var(--primary)"></div>',
      { cssText: ':root { --primary: blue }', variables: {} }
    )
    expect(named(graph, 'own').boundVariables).toEqual({})
  })

  test('tell apart properties that hold one color', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="a" style="width:9px;height:9px;background:var(--a)"></div><div id="b" style="width:9px;height:9px;background:var(--b)"></div>',
      { cssText: ':root { --a: #eee; --b: #eee }', variables: {} }
    )
    expect(bound(graph, named(graph, 'a'), 'fills/0/color')).toBe('a')
    expect(bound(graph, named(graph, 'b'), 'fills/0/color')).toBe('b')
  })

  test('are not imported unless asked for', async () => {
    const { graph } = await readHTMLDocument(KIT, { cssText: THEME })
    expect(graph.variables.size).toBe(0)
    expect([...graph.getAllNodes()].some(({ type }) => type === 'COMPONENT')).toBe(false)
  })
})

describe('components a page marks', () => {
  test('become a set with its variants and one property they share', async () => {
    const set = named(await kit(), 'Button')
    expect(set.type).toBe('COMPONENT_SET')
    expect(
      set.componentPropertyDefinitions.map(({ name, type, defaultValue, variantOptions }) => ({
        name,
        type,
        defaultValue,
        variantOptions
      }))
    ).toEqual([
      {
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Rest',
        variantOptions: ['Rest', 'Hover', 'Focus', 'Outline']
      },
      { name: 'Label', type: 'TEXT', defaultValue: 'Save', variantOptions: undefined }
    ])
  })

  test('take slots and visibility, and survive a .fig round trip', async () => {
    const bytes = await exportFigFile(await kit())
    const graph = await parseFigFile(bytes.slice().buffer)
    const card = named(graph, 'Card')
    expect(card.type).toBe('COMPONENT')
    expect(card.componentPropertyDefinitions.map(({ name, type }) => [name, type]).sort()).toEqual([
      ['Content', 'SLOT'],
      ['Hint', 'BOOLEAN']
    ])
    expect(named(graph, 'Button').componentPropertyDefinitions).toHaveLength(2)
    expect(bound(graph, named(graph, 'State=Rest'), 'fills/0/color')).toBe('primary')
  })

  test('refuse a property marked outside a component', async () => {
    await expect(
      readHTMLDocument('<p data-op-text="Label">Hi</p>', { components: true })
    ).rejects.toThrow('outside a component')
  })
})

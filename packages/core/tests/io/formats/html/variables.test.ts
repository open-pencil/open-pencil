import { describe, expect, test } from 'bun:test'

import { bound, KIT, kit, named, THEME, values, VARIABLES } from '#core-tests/helpers/html/kit'

import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneNode } from '@open-pencil/scene-graph'

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

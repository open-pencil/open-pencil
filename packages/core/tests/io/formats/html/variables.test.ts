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

  test('leave a property set nearer to the root value unbound', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="same" style="--primary:blue;width:9px;height:9px;background:var(--primary)"></div><div id="root" style="width:9px;height:9px;background:var(--primary)"></div>',
      { cssText: ':root { --primary: blue } div { --other: 1px }', variables: {} }
    )
    expect(named(graph, 'same').boundVariables).toEqual({})
    expect(bound(graph, named(graph, 'root'), 'fills/0/color')).toBe('primary')
  })

  test('take the root value whatever the page sets on its elements', async () => {
    const { graph } = await readHTMLDocument('<p>x</p>', {
      cssText: ':root { --a: blue; --none: transparent } div { --a: red } * { --a: green }',
      variables: {}
    })
    expect(values(graph, 'a')).toMatchObject([{ r: 0, g: 0, b: 1 }])
    expect(values(graph, 'none')).toMatchObject([{ a: 0 }])
  })

  test('take the root value over important rules that reach every element', async () => {
    const { graph } = await readHTMLDocument('<p>x</p>', {
      cssText:
        ':root { --a: blue } body > :not(#x) { --a: red !important } body :not(#x) { --a: green !important }',
      variables: {}
    })
    expect(values(graph, 'a')).toMatchObject([{ r: 0, g: 0, b: 1 }])
  })

  test('read each value past generated content', async () => {
    const { graph } = await readHTMLDocument('<p>x</p>', {
      cssText: ':root { --a: red; --b: blue } *::before { content: "x"; color: green }',
      variables: {}
    })
    expect(values(graph, 'a')).toMatchObject([{ r: 1, g: 0, b: 0 }])
    expect(values(graph, 'b')).toMatchObject([{ r: 0, g: 0, b: 1 }])
  })

  test('hold the color a mode shows where the property is no color in it', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="box" style="width:9px;height:9px;background-color:var(--paint)"></div>',
      {
        cssText: ':root { --paint: red } .dark { --paint: 12px }',
        variables: VARIABLES
      }
    )
    const name = bound(graph, named(graph, 'box'), 'fills/0/color')
    expect(values(graph, name ?? '')).toMatchObject([{ aliasId: expect.any(String) }, { a: 0 }])
  })

  test('leave inline SVG that names another property of the same color unbound', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="color:var(--ink)"><svg id="art" width="20" height="20" viewBox="0 0 20 20"><path style="fill:var(--accent)" d="M0 0h9v9z"/></svg></div>',
      {
        cssText:
          ':root { --ink: #112233; --accent: #112233 } .dark { --ink: white; --accent: red }',
        variables: VARIABLES
      }
    )
    const [path] = graph.getChildren(named(graph, 'art').id)
    expect(path.fills).toHaveLength(1)
    expect(path.boundVariables).toEqual({})
  })

  test('bind a line height only when its variable is its pixels in every mode', async () => {
    const { graph } = await readHTMLDocument(
      `<p style="font-size:16px;line-height:var(--mixed)">Mixed</p>
       <p style="font-size:16px;line-height:var(--pixels)">Pixels</p>`,
      {
        cssText: ':root { --mixed: 32px; --pixels: 32px } .dark { --mixed: 2; --pixels: 40px }',
        variables: VARIABLES
      }
    )
    expect(bound(graph, named(graph, 'Mixed'), 'lineHeight')).toBeUndefined()
    expect(bound(graph, named(graph, 'Pixels'), 'lineHeight')).toBe('pixels')
  })

  test('bind letter spacing, and inline SVG only where it follows the color', async () => {
    const { graph } = await readHTMLDocument(
      `<p style="letter-spacing:var(--track);color:var(--ink)">Spaced</p>
       <div style="color:var(--ink)"><svg id="follows" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M0 0h9v9z"/></svg>
       <svg id="fixed" width="20" height="20" viewBox="0 0 20 20"><path fill="#000000" d="M0 0h9v9z"/></svg></div>`,
      { cssText: ':root { --track: 2px; --ink: #000000 }', variables: {} }
    )
    expect(bound(graph, named(graph, 'Spaced'), 'letterSpacing')).toBe('track')
    const paints = (id: string) =>
      graph.getChildren(named(graph, id).id).map((layer) => bound(graph, layer, 'fills/0/color'))
    expect(paints('follows')).toEqual(['ink'])
    expect(paints('fixed')).toEqual([undefined])
  })

  test('stop expanding properties that double at every step', async () => {
    const steps = Array.from({ length: 18 }, (_, i) => `--s${i + 1}: var(--s${i}) var(--s${i})`)
    const { graph } = await readHTMLDocument(
      `<div id="bomb" style="--s0:;${steps.join(';')};width:9px;height:9px;background:var(--s18) red"></div>`,
      { variables: {} }
    )
    expect(named(graph, 'bomb').boundVariables).toEqual({})
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

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
    expect(bound(graph, rest, 'cornerRadius')).toBe('radius')
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

  test('bind elements a mode adds generated content beside', async () => {
    const { graph } = await readHTMLDocument(
      '<div class="box"><i id="ink" style="display:block;width:9px;height:9px;background:var(--ink)"></i></div>',
      {
        cssText:
          ':root { --ink: #112233 } .dark { --ink: white } .dark .box::before { content: "+" }',
        variables: VARIABLES
      }
    )
    expect(bound(graph, named(graph, 'ink'), 'fills/0/color')).toBe('ink')
  })

  test('compute lengths, colors, and numbers as the root does', async () => {
    const { graph } = await readHTMLDocument('<p>x</p>', {
      cssText:
        'html { font-size: 10px; color: rgb(0 0 255) } :root { --gap: calc(2rem + 1px); --mix: color-mix(in srgb, currentColor 50%, white); --scale: 1.5; --share: 50%; --font: Inter, sans-serif }',
      variables: {}
    })
    expect(values(graph, 'gap')).toEqual([21])
    expect(values(graph, 'mix')).toMatchObject([{ r: 0.5, g: 0.5, b: 1, a: 1 }])
    expect(values(graph, 'scale')).toEqual([1.5])
    const names = [...graph.variables.values()].map(({ name }) => name)
    expect(names).not.toContain('share')
    expect(names).not.toContain('font')
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

  test('bind a mask whose element has black text', async () => {
    const svg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0h9v9z"/></svg>'
    )
    const { graph } = await readHTMLDocument(
      `<div id="mask" style="width:20px;height:20px;background:var(--ink);mask:url('data:image/svg+xml,${svg}')"></div>`,
      { cssText: ':root { --ink: #112233 } .dark { --ink: white }', variables: VARIABLES }
    )
    const [shape] = graph.getChildren(named(graph, 'mask').id)
    expect(bound(graph, shape, 'fills/0/color')).toBe('ink')
  })

  test('bind the SVG paints that follow the color, beside fixed ones of the same color', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="color:var(--ink)"><svg id="art" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M0 0h9v9z"/><path fill="#112233" d="M9 9h9v9z"/></svg></div>',
      {
        cssText: ':root { --ink: #112233 } .dark { --ink: white }',
        variables: VARIABLES
      }
    )
    const paints = graph
      .getChildren(named(graph, 'art').id)
      .map((layer) => bound(graph, layer, 'fills/0/color'))
    expect(paints).toEqual(['ink', undefined])
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

  test('bind a ring that became an outside stroke', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="ring" style="width:9px;height:9px;box-shadow:0 0 #0000, 0 0 0 3px var(--ring)"></div>',
      { cssText: ':root { --ring: #112233 } .dark { --ring: white }', variables: VARIABLES }
    )
    expect(bound(graph, named(graph, 'ring'), 'strokes/0/color')).toBe('ring')
  })

  test('bind one radius for four equal corners, and each corner when they differ', async () => {
    const { graph } = await readHTMLDocument(
      `<div id="round" style="width:9px;height:9px;border-radius:var(--radius)"></div>
       <div id="corners" style="width:9px;height:9px;border-top-left-radius:var(--radius)"></div>`,
      { cssText: ':root { --radius: 4px } .dark { --radius: 12px }', variables: VARIABLES }
    )
    expect(bound(graph, named(graph, 'round'), 'cornerRadius')).toBe('radius')
    expect(bound(graph, named(graph, 'corners'), 'topLeftRadius')).toBe('radius')
  })

  test('bind generated content, and the window of a framed page, in every mode', async () => {
    const { graph } = await readHTMLDocument('<div class="tag"></div>', {
      cssText:
        ':root { --surface: #ffffff; --ink: #112233 } .dark { --surface: #000000; --ink: #eeeeee } body { background: var(--surface) } .tag::before { content: ""; display: block; width: 9px; height: 9px; background: var(--ink) }',
      variables: VARIABLES,
      framed: true
    })
    const [page] = graph.getPages()
    const [window] = graph.getChildren(page.id)
    expect(bound(graph, window, 'fills/0/color')).toBe('surface')
    const before = [...graph.getAllNodes()].find((node) => node.name === '::before')
    expect(before && bound(graph, before, 'fills/0/color')).toBe('ink')
  })

  test('take the window of a framed page from the root in a mode where only it paints', async () => {
    const { graph } = await readHTMLDocument('<div>Text</div>', {
      cssText:
        ':root { --canvas: #ffffff } .dark { --canvas: #000000 } html.dark { background: var(--canvas) } body { background: #ffffff }',
      variables: VARIABLES,
      framed: true
    })
    const [page] = graph.getPages()
    const [window] = graph.getChildren(page.id)
    expect(bound(graph, window, 'fills/0/color')).toBe('#FFFFFF | canvas')
  })

  test('leave an SVG child that sets the artwork color itself unbound', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="color:var(--ink)"><svg id="art" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M0 0h9v9z"/><path class="fixed" fill="currentColor" d="M9 9h9v9z"/></svg></div>',
      {
        cssText: ':root { --ink: #112233 } .dark { --ink: white } .fixed { color: #112233 }',
        variables: VARIABLES
      }
    )
    const paints = graph
      .getChildren(named(graph, 'art').id)
      .map((layer) => bound(graph, layer, 'fills/0/color'))
    expect(paints).toEqual(['ink', undefined])
  })

  test('draw an SVG child in the artwork color inside a group of another color', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="color:var(--ink)"><svg id="art" width="20" height="20" viewBox="0 0 20 20"><g class="group"><path class="reset" fill="currentColor" d="M0 0h9v9z"/></g></svg></div>',
      {
        cssText:
          ':root { --ink: #112233 } .dark { --ink: white } .group { color: red } .reset { color: var(--ink) }',
        variables: VARIABLES
      }
    )
    const path = [...graph.getAllNodes()].find(
      (node) => node.type === 'VECTOR' && node.fills.length > 0
    )
    expect(path?.fills[0]).toMatchObject({ color: { r: 0x11 / 255, g: 0x22 / 255, b: 0x33 / 255 } })
  })

  test('keep a border transparent in one mode that another colors', async () => {
    const { graph } = await readHTMLDocument(
      '<div id="box" style="width:9px;height:9px;border:1px solid var(--line);box-shadow:0 0 0 3px red"></div>',
      { cssText: ':root { --line: transparent } .dark { --line: #112233 }', variables: VARIABLES }
    )
    const box = named(graph, 'box')
    expect(box.strokes).toMatchObject([{ align: 'INSIDE', weight: 1 }])
    expect(box.effects).toMatchObject([{ spread: 3 }])
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

  test('name a color only by the property it is or fades', async () => {
    const { graph } = await readHTMLDocument(
      `<div id="mix" style="width:9px;height:9px;background:color-mix(in srgb, var(--a), var(--b))"></div>
       <div id="fade" style="width:9px;height:9px;background:color-mix(in srgb, var(--a) 40%, transparent)"></div>`,
      { cssText: ':root { --a: red; --b: blue }', variables: {} }
    )
    expect(bound(graph, named(graph, 'mix'), 'fills/0/color')).toBe('Color 1')
    expect(bound(graph, named(graph, 'fade'), 'fills/0/color')).toBe('a 40%')
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

import { describe, expect, test } from 'bun:test'

import { pick } from 'es-toolkit'

import { expectDefined } from '#core-tests/helpers/assert'

import { renderJSX, renderTree } from '@open-pencil/core/design-jsx'
import {
  defineMode,
  defineVars,
  Frame,
  Rectangle,
  sceneNodeToJSX,
  selectionToJSXWithLayers
} from '@open-pencil/design-jsx'
import { SceneGraph, type VariableCollection } from '@open-pencil/scene-graph'

const THEME = `
const palette = defineVars('Palette', { 'Gray/900': '#111111', 'Gray/50': '#FAFAFA' })
const theme = defineVars('Theme', { Page: palette['Gray/50'], Text: palette['Gray/900'], Radius: 12 }, { mode: 'Light' })
const dark = defineMode(theme, 'Dark', { Page: palette['Gray/900'], Text: palette['Gray/50'] })
return <Frame name="Card" mode={dark} bg={theme.Page} rounded={theme.Radius} w={100} h={100} />`

function collectionNamed(graph: SceneGraph, name: string): VariableCollection {
  const collection = [...graph.variableCollections.values()].find((item) => item.name === name)
  if (!collection) throw new Error(`Missing collection ${name}`)
  return collection
}

function table(graph: SceneGraph, name: string) {
  const collection = collectionNamed(graph, name)
  return Object.fromEntries(
    collection.variableIds.map((id) => {
      const variable = graph.variables.get(id)
      if (!variable) throw new Error(`Missing variable ${id}`)
      const values = collection.modes.map(({ modeId, name: mode }) => {
        const value = variable.valuesByMode[modeId]
        const shown =
          typeof value === 'object' && 'aliasId' in value
            ? `→ ${graph.variables.get(value.aliasId)?.name}`
            : value
        return [mode, shown]
      })
      return [variable.name, { type: variable.type, ...Object.fromEntries(values) }]
    })
  )
}

describe('Design JSX variable definitions', () => {
  test('create collections, modes, and aliases in the variables table', async () => {
    const graph = new SceneGraph()
    await renderJSX(graph, THEME)
    const theme = collectionNamed(graph, 'Theme')
    expect(theme.modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
    expect(theme.defaultModeId).toBe(theme.modes[0].modeId)
    expect(collectionNamed(graph, 'Palette').modes.map((mode) => mode.name)).toEqual(['Mode 1'])
    expect(table(graph, 'Theme')).toEqual({
      Page: { type: 'COLOR', Light: '→ Gray/50', Dark: '→ Gray/900' },
      Text: { type: 'COLOR', Light: '→ Gray/900', Dark: '→ Gray/50' },
      Radius: { type: 'FLOAT', Light: 12, Dark: 12 }
    })
  })

  test('pin the mode on the layer and bind its fields with the values of that mode', async () => {
    const graph = new SceneGraph()
    const [card] = await renderJSX(graph, THEME)
    const node = graph.getNode(card.id)
    const theme = collectionNamed(graph, 'Theme')
    expect(node?.variableModes).toEqual({ [theme.id]: theme.modes[1].modeId })
    expect(node?.fills[0]?.color).toMatchObject({ r: 0x11 / 255, g: 0x11 / 255, b: 0x11 / 255 })
    expect(node?.cornerRadius).toBe(12)
    const page = theme.variableIds
      .map((id) => graph.variables.get(id))
      .find((item) => item?.name === 'Page')
    expect(node?.boundVariables['fills/0/color']).toBe(page?.id)
  })

  test('running the JSX again updates the collections it defined instead of adding new ones', async () => {
    const graph = new SceneGraph()
    await renderJSX(graph, THEME)
    await renderJSX(graph, THEME.replace('Radius: 12', 'Radius: 16'))
    expect([...graph.variableCollections.values()].map((item) => item.name)).toEqual([
      'Palette',
      'Theme'
    ])
    expect(graph.variables.size).toBe(5)
    expect(table(graph, 'Theme').Radius).toEqual({ type: 'FLOAT', Light: 16, Dark: 16 })
  })

  test('binding one variable brings its whole collection, unbound modes included', async () => {
    const graph = new SceneGraph()
    const space = defineVars('Spacing', { Small: 4, Large: 16 }, { mode: 'Comfortable' })
    defineMode(space, 'Compact', { Large: 8 })
    await renderTree(graph, Frame({ p: space.Large, children: Rectangle({ w: 10, h: 10 }) }))
    expect(table(graph, 'Spacing')).toEqual({
      Small: { type: 'FLOAT', Comfortable: 4, Compact: 4 },
      Large: { type: 'FLOAT', Comfortable: 16, Compact: 8 }
    })
  })

  test('reject values the variables cannot hold, and modes and names that do not exist', async () => {
    const graph = new SceneGraph()
    const invalid = defineVars('Broken', { Ink: 'not a color' })
    await expect(renderTree(graph, Frame({ bg: invalid.Ink }))).rejects.toThrow(
      'Variable Ink has "not a color", which is not a color'
    )
    const mixed = defineVars('Mixed', { Size: 4 })
    defineMode(mixed, 'Loud', { Size: '#FF0000' })
    await expect(renderTree(graph, Frame({ p: mixed.Size }))).rejects.toThrow(
      'Variable Size mixes FLOAT with COLOR values'
    )
    const theme = defineVars('Shades', { Page: '#FFFFFF' })
    expect(() => defineMode(theme, 'Dark', { Missing: '#000000' })).toThrow(
      'Collection Shades has no variable named Missing'
    )
    defineMode(theme, 'Dark', {})
    expect(() => defineMode(theme, 'Dark', {})).toThrow('already has a mode named Dark')
    await expect(renderJSX(graph, `<Frame mode={designMode('Nope', 'Dark')} />`)).rejects.toThrow(
      'Unknown variable collection: Nope'
    )
  })
})

describe('Design JSX export of variables', () => {
  test('writes the definitions its layers use, which render the same tokens in another file', async () => {
    const graph = new SceneGraph()
    await renderJSX(graph, `const unused = defineVars('Unused', { Other: 1 }); return <Frame w={unused.Other} />`)
    const [card] = await renderJSX(graph, THEME)
    const exported = sceneNodeToJSX(card.id, graph)
    expect(exported).toBe(`const palette = defineVars("Palette", { "Gray/900": "#111111", "Gray/50": "#FAFAFA" })
const theme = defineVars("Theme", { Page: palette["Gray/50"], Radius: 12 }, { mode: "Light" })
const dark = defineMode(theme, "Dark", { Page: palette["Gray/900"] })

return <Frame name="Card" w={100} h={100} bg={theme.Page} rounded={theme.Radius} mode={dark} />`)

    const copy = new SceneGraph()
    const [rendered] = await renderJSX(copy, exported)
    // Only what the card uses: Theme's Text is left out.
    expect(table(copy, 'Theme')).toEqual(pick(table(graph, 'Theme'), ['Page', 'Radius']))
    expect(table(copy, 'Palette')).toEqual(table(graph, 'Palette'))
    expect([...copy.variableCollections.values()].map((item) => item.name)).toEqual([
      'Palette',
      'Theme'
    ])
    const node = copy.getNode(rendered.id)
    const theme = collectionNamed(copy, 'Theme')
    expect(node?.variableModes).toEqual({ [theme.id]: theme.modes[1].modeId })
    expect(Object.keys(node?.boundVariables ?? {})).toEqual(['fills/0/color', 'cornerRadius'])
  })

  test('writes references instead when it declares nothing, or JSX cannot define a variable', async () => {
    const graph = new SceneGraph()
    const [card] = await renderJSX(graph, THEME)
    const references = selectionToJSXWithLayers([card.id], graph, { declarations: false }).code
    expect(references).toBe(
      '<Frame name="Card" w={100} h={100} bg={designVar("Page")} rounded={designVar("Radius")} mode={designMode("Theme", "Dark")} />'
    )

    const strings = graph.createCollection('Copy')
    const label = graph.createVariable('Label', 'STRING', strings.id, 'Hi')
    const [text] = await renderJSX(graph, '<Text>Hi</Text>')
    graph.bindVariable(text.id, 'text', label.id)
    expect(sceneNodeToJSX(text.id, graph)).toContain('bind={{ text: designVar("Label") }}')
  })

  test('writes an alias to its own collection by reference, and names no handle a reserved word', async () => {
    const graph = new SceneGraph()
    const [card] = await renderJSX(
      graph,
      `const space = defineVars('Space', { Base: 4 }, { mode: 'Default' })
const roomy = defineMode(space, 'Roomy', { Base: 8 })
return <Frame name="Card" flex="col" mode={roomy} p={space.Base} />`
    )
    const collection = collectionNamed(graph, 'Space')
    const base = expectDefined(graph.variables.get(collection.variableIds[0]))
    const gap = graph.createVariable('Gap', 'FLOAT', collection.id, { aliasId: base.id })
    graph.bindVariable(card.id, 'itemSpacing', gap.id)
    graph.updateNode(card.id, {
      variableModes: { [collection.id]: collection.modes[0].modeId }
    })
    graph.renameMode(collection.id, collection.modes[1].modeId, 'Default')
    graph.renameMode(collection.id, collection.modes[0].modeId, 'Roomy')
    const exported = sceneNodeToJSX(card.id, graph)
    expect(exported).toContain('gap={designVar("Gap")}')
    expect(exported).not.toMatch(/const default\b/)
    // The code runs: no handle is read before it is declared.
    const [copy] = await renderJSX(graph, exported)
    expect(graph.getNode(copy.id)?.boundVariables.itemSpacing).toBe(gap.id)
  })

  test('declares no variable whose name its collection shares, nor one that aliases it', async () => {
    const graph = new SceneGraph()
    const space = graph.createCollection('Space')
    const first = graph.createVariable('Pad', 'FLOAT', space.id, 4)
    const second = graph.createVariable('Pad', 'FLOAT', space.id, 8)
    const palette = graph.createCollection('Palette')
    const base = graph.createVariable('Base', 'FLOAT', palette.id, 2)
    const derived = graph.createVariable('Derived', 'FLOAT', palette.id, { aliasId: base.id })
    const theme = graph.createCollection('Theme')
    const spacing = graph.createVariable('Spacing', 'FLOAT', theme.id, { aliasId: derived.id })
    const [card] = await renderJSX(graph, '<Frame name="Card" flex="col" w={10} h={10} />')
    graph.bindVariable(card.id, 'itemSpacing', second.id)
    graph.bindVariable(card.id, 'cornerRadius', spacing.id)

    const exported = sceneNodeToJSX(card.id, graph)
    // Derived aliases its own collection, so it and Spacing, which aliases it, stay references.
    expect(exported).not.toContain('defineVars(')
    expect(exported).toContain('rounded={designVar("Spacing")}')
    const [copy] = await renderJSX(graph, exported)
    expect(graph.getNode(copy.id)?.boundVariables).toEqual({
      itemSpacing: second.id,
      cornerRadius: spacing.id
    })
    expect(first.valuesByMode[space.defaultModeId]).toBe(4)
  })

  test('writes a padding bound on every side as p, and a partly bound one in bind', async () => {
    const graph = new SceneGraph()
    const space = 'const s = defineVars("Space", { M: 8, L: 16 })'
    const [even] = await renderJSX(graph, `${space}; return <Frame flex="col" p={s.M} />`)
    expect(sceneNodeToJSX(even.id, graph)).toContain('p={space.M}')
    const [uneven] = await renderJSX(graph, `${space}; return <Frame flex="col" px={s.M} py={s.L} pt={4} />`)
    const exported = sceneNodeToJSX(uneven.id, graph)
    expect(exported).toContain('pt={4} pr={space.M} pb={space.L} pl={space.M}')
    expect(exported).not.toContain('bind=')
  })

  test('writes a binding in bind where its prop would change the layer it renders', async () => {
    const graph = new SceneGraph()
    const [row] = await renderJSX(
      graph,
      `const s = defineVars("Space", { M: 8 })
return <Frame name="Row" flex="row" w={200} h={50} p={s.M}>
  <Frame name="Bar" w={20} h="fill" />
  <Frame name="Card" rounded={8} w={40} h={40} />
</Frame>`
    )
    const m = expectDefined(collectionNamed(graph, 'Space').variableIds[0])
    const child = (name: string) =>
      expectDefined(graph.getChildren(row.id).find((node) => node.name === name))
    graph.bindVariable(child('Bar').id, 'height', m)
    graph.bindVariable(child('Card').id, 'topLeftRadius', m)
    const [loose] = await renderJSX(graph, '<Frame name="Loose" w={40} h={40} />')
    graph.updateNode(loose.id, { paddingLeft: 8 })
    graph.bindVariable(loose.id, 'paddingLeft', m)

    const exported = sceneNodeToJSX(row.id, graph)
    // The bar keeps filling the row, and the card's other corners keep their radius.
    expect(exported).toContain('w={20} h="fill" bind={{ height: space.M }}')
    expect(exported).toContain('roundedTL={space.M} roundedTR={8} roundedBR={8} roundedBL={8}')
    // A padding prop would give the frame auto layout.
    expect(sceneNodeToJSX(loose.id, graph)).toContain('bind={{ paddingLeft: space.M }}')

    const [copy] = await renderJSX(graph, exported)
    const bar = expectDefined(graph.getChildren(copy.id).find((node) => node.name === 'Bar'))
    expect(bar.height).toBe(child('Bar').height)
    const card = expectDefined(graph.getChildren(copy.id).find((node) => node.name === 'Card'))
    expect(pick(card, ['topLeftRadius', 'topRightRadius', 'bottomRightRadius'])).toEqual({
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 8
    })
    const [looseCopy] = await renderJSX(graph, sceneNodeToJSX(loose.id, graph))
    expect(graph.getNode(looseCopy.id)?.layoutMode).toBe('NONE')
  })
})

test('artwork drawn in a variable binds its paths and resolves in its own mode', async () => {
  const graph = new SceneGraph()
  const [svg] = await renderJSX(
    graph,
    `const ink = defineVars('Ink', { Line: '#000000' }, { mode: 'Light' })
const dark = defineMode(ink, 'Dark', { Line: '#FFFFFF' })
return <svg mode={dark} color={ink.Line} w={10} h={10} body="<path d='M0 0h10v10H0z' fill='currentColor'/>" />`
  )
  const ink = collectionNamed(graph, 'Ink')
  const line = ink.variableIds[0]
  const node = graph.getNode(svg.id)
  expect(node?.variableModes).toEqual({ [ink.id]: ink.modes[1].modeId })
  const paths = graph.getChildren(svg.id).flatMap((child) => [child, ...graph.getChildren(child.id)])
  const painted = paths.find((child) => child.fills[0]?.type === 'SOLID')
  expect(painted?.boundVariables['fills/0/color']).toBe(line)
  expect(painted?.fills[0]?.color).toMatchObject({ r: 1, g: 1, b: 1 })
})

test('a variable whose value cannot be resolved is an error, not a dropped paint', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Loop')
  const a = graph.createVariable('A', 'COLOR', collection.id)
  const b = graph.createVariable('B', 'COLOR', collection.id)
  a.valuesByMode[collection.defaultModeId] = { aliasId: b.id }
  b.valuesByMode[collection.defaultModeId] = { aliasId: a.id }
  await expect(renderJSX(graph, `<Frame bg={designVar('A')} />`)).rejects.toThrow(
    'Cannot resolve variable A for bg'
  )
  const size = graph.createCollection('Size')
  graph.createVariable('Gap', 'FLOAT', size.id, 4)
  for (const name of ['A', 'Gap']) {
    await expect(
      renderJSX(graph, `<svg color={designVar('${name}')} body="<path d='M0 0h1v1H0z'/>" />`)
    ).rejects.toThrow(`Cannot resolve color variable ${name} for color`)
  }
})

test('designVar names a variable by collection when several collections share its name', async () => {
  const graph = new SceneGraph()
  await renderJSX(graph, THEME)
  await renderJSX(graph, `const d = defineVars('Density', { Page: 8 }); return <Frame p={d.Page} />`)
  await expect(renderJSX(graph, `<Frame bg={designVar('Page')} />`)).rejects.toThrow(
    "Variable name Page is in more than one collection; name one, as in designVar('Theme', 'Page')"
  )
  await expect(renderJSX(graph, `<Frame bg={designVar('Theme', 'Missing')} />`)).rejects.toThrow(
    'Unknown variable Missing in Theme'
  )
  const [frame] = await renderJSX(
    graph,
    `<Frame bg={designVar('Theme', 'Page')} p={designVar('Density', 'Page')} />`
  )
  const node = graph.getNode(frame.id)
  const id = (collection: string) => {
    const owner = collectionNamed(graph, collection)
    return owner.variableIds.find((item) => graph.variables.get(item)?.name === 'Page')
  }
  expect(node?.boundVariables['fills/0/color']).toBe(id('Theme'))
  expect(node?.boundVariables.paddingTop).toBe(id('Density'))
  const exported = sceneNodeToJSX(frame.id, graph)
  const references = selectionToJSXWithLayers([frame.id], graph, { declarations: false }).code
  expect(references).toContain('designVar("Theme", "Page")')
  expect(references).toContain('designVar("Density", "Page")')
  expect(exported).toContain('bg={theme.Page} p={density.Page}')
  const [copy] = await renderJSX(graph, exported)
  expect(graph.getNode(copy.id)?.boundVariables).toEqual(node?.boundVariables)
})

test('a collection name several collections share is an error, not the first of them', async () => {
  const graph = new SceneGraph()
  for (const _ of [0, 1]) graph.createVariable('Ink', 'COLOR', graph.createCollection('Twin').id)
  for (const jsx of [
    `<Frame bg={designVar('Twin', 'Ink')} />`,
    `<Frame mode={designMode('Twin', 'Mode 1')} />`
  ]) {
    await expect(renderJSX(graph, jsx)).rejects.toThrow(
      'More than one variable collection is named Twin; rename one to use it'
    )
  }
  // Export names such a collection by its ID, which renders back into the same mode.
  const twin = expectDefined([...graph.variableCollections.values()].at(-1))
  const [frame] = await renderJSX(graph, '<Frame w={10} h={10} />')
  graph.updateNode(frame.id, { variableModes: { [twin.id]: twin.defaultModeId } })
  const exported = sceneNodeToJSX(frame.id, graph)
  expect(exported).toContain(`mode={designMode("${twin.id}", "Mode 1")}`)
  const [copy] = await renderJSX(graph, exported)
  expect(graph.getNode(copy.id)?.variableModes).toEqual({ [twin.id]: twin.defaultModeId })
})

test('a sticky note pins its mode and reads its values in it, as any layer does', async () => {
  const graph = new SceneGraph()
  const [board] = await renderJSX(
    graph,
    `const fade = defineVars('Fade', { Note: 1 }, { mode: 'Light' })
const dark = defineMode(fade, 'Dark', { Note: 0.5 })
return <Frame name="Board" w={400} h={400}><Sticky mode={dark} opacity={fade.Note}>Hi</Sticky></Frame>`
  )
  const [sticky] = graph.getChildren(board.id)
  const fade = collectionNamed(graph, 'Fade')
  expect(sticky.variableModes).toEqual({ [fade.id]: fade.modes[1].modeId })
  expect(sticky.opacity).toBe(0.5)
})

test('a reference export writes is one rendering resolves back to the same variable', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Ink')
  graph.addVariable({
    id: 'x',
    name: 'Other',
    type: 'COLOR',
    collectionId: collection.id,
    valuesByMode: { [collection.defaultModeId]: { r: 0, g: 0, b: 0, a: 1 } },
    description: '',
    hiddenFromPublishing: false
  })
  // Named as the other variable's ID, which `designVar('x')` finds first.
  const named = graph.createVariable('x', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  const [frame] = await renderJSX(graph, '<Frame bg="#FFFFFF" />')
  graph.bindVariable(frame.id, 'fills/0/color', named.id)
  const references = selectionToJSXWithLayers([frame.id], graph, { declarations: false }).code
  expect(references).toContain('bg={designVar("Ink", "x")}')
  const [copy] = await renderJSX(graph, references)
  expect(graph.getNode(copy.id)?.boundVariables['fills/0/color']).toBe(named.id)
})

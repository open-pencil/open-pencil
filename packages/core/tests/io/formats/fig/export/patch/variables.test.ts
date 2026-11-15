import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { open } from '#core-tests/helpers/fig/archive'
import { exportBothWays, layerNamed, pageNamed, recordsOf } from '#core-tests/helpers/fig/patch'
import { isEqual } from 'es-toolkit/predicate'

import { exportFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { setDefaultMode } from '@open-pencil/scene-graph/variables'
import { expectDefined } from '@open-pencil/test-support/assert'

import { populateFigInternalPages } from '#core/kiwi/fig/session/document-state'
import { reconcileVariableLayouts } from '#core/layout/variables'

setDefaultTimeout(60_000)

describe('writing variables of an edited document into its archive', () => {
  test('keeps layers on unopened pages bound to a variable whose value changes', async () => {
    const { patched } = await exportBothWays((graph) => {
      const [variable] = graph.variables.values()
      const [modeId] = Object.keys(variable.valuesByMode)
      variable.valuesByMode[modeId] = { r: 0, g: 0, b: 1, a: 1 }
    })
    const reopened = await open(patched)
    populateFigPage(reopened, pageNamed(reopened, 'Bound').id)
    const branded = layerNamed(reopened, 'Branded')
    const variableId = branded.boundVariables['fills/0/color']
    expect(reopened.variables.get(variableId)?.name).toBe('brand')
    expect(Object.values(reopened.variables.get(variableId)?.valuesByMode ?? {})[0]).toEqual({
      r: 0,
      g: 0,
      b: 1,
      a: 1
    })
  })

  test("writes a page's variable mode into its record, and clears it", async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const darkId = expectDefined(source.createMode(collection.id, 'Dark'), 'dark mode')
    source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Card' })
    const bytes = await exportFigFile(source)

    const pageModes = async (saved: Uint8Array) => (await open(saved)).getPages()[0].variableModes
    const changedRecords = (before: Uint8Array, after: Uint8Array) => {
      const saved = recordsOf(before)
      return [...recordsOf(after)].flatMap(([guid, record]) =>
        isEqual(saved.get(guid), record) ? [] : [record.type]
      )
    }

    const graph = await open(bytes)
    graph.updateNode(graph.getPages()[0].id, { variableModes: { [collection.id]: darkId } })
    const dark = await exportFigFile(graph)
    expect(changedRecords(bytes, dark)).toEqual(['CANVAS'])
    expect(await pageModes(dark)).toEqual({ [collection.id]: darkId })

    const reopened = await open(dark)
    reopened.updateNode(reopened.getPages()[0].id, { variableModes: {} })
    const cleared = await exportFigFile(reopened)
    expect(changedRecords(dark, cleared)).toEqual(['CANVAS'])
    expect(await pageModes(cleared)).toEqual({})
  })

  test('rewrites bound layers below a page or frame whose mode changes', async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const lightId = collection.defaultModeId
    const darkId = expectDefined(source.createMode(collection.id, 'Dark'), 'dark mode')
    const surface = source.createVariable('surface', 'COLOR', collection.id)
    surface.valuesByMode[lightId] = { r: 1, g: 1, b: 1, a: 1 }
    surface.valuesByMode[darkId] = { r: 0, g: 0, b: 0, a: 1 }
    const page = source.getPages()[0]
    const frame = source.createNode('FRAME', page.id, { name: 'Panel' })
    const holder = source.createNode('FRAME', page.id, { name: 'Holder' })
    for (const [name, parentId] of [
      ['On page', holder.id],
      ['In panel', frame.id]
    ]) {
      const card = source.createNode('RECTANGLE', parentId, {
        name,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
      })
      source.bindVariable(card.id, 'fills/0/color', surface.id)
    }
    const internal = source.createNode('CANVAS', source.rootId, { internalOnly: true })
    const stored = source.createNode('RECTANGLE', internal.id, {
      name: 'Internal',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    source.bindVariable(stored.id, 'fills/0/color', surface.id)
    const bytes = await exportFigFile(source)
    const fillOf = (saved: Uint8Array, name: string) =>
      [...recordsOf(saved).values()].find((record) => record.name === name)?.fillPaints?.[0]?.color

    // As the editor sets a mode: bound paints refresh for the layers below it.
    const setMode = (graph: SceneGraph, id: string, modes: Record<string, string>) => {
      graph.updateNode(id, { variableModes: modes })
      reconcileVariableLayouts(graph, { subtrees: [id] })
    }
    const graph = await open(bytes)
    setMode(graph, layerNamed(graph, 'Panel').id, { [collection.id]: darkId })
    const panelDark = await exportFigFile(graph)
    expect(fillOf(panelDark, 'In panel')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(fillOf(panelDark, 'On page')).toEqual({ r: 1, g: 1, b: 1, a: 1 })

    const reopened = await open(panelDark)
    setMode(reopened, reopened.getPages()[0].id, { [collection.id]: darkId })
    const pageDark = await exportFigFile(reopened)
    expect(fillOf(pageDark, 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    const moved = await open(panelDark)
    moved.reparentNode(layerNamed(moved, 'Holder').id, layerNamed(moved, 'Panel').id)
    expect(fillOf(await exportFigFile(moved), 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    // The old parent changes mode too, so only its saved mode shows the moved layer changed.
    const left = await open(panelDark)
    const inner = left.createNode('FRAME', layerNamed(left, 'Holder').id, { name: 'Inner' })
    left.reparentNode(layerNamed(left, 'On page').id, inner.id)
    setMode(left, layerNamed(left, 'Holder').id, { [collection.id]: lightId })
    setMode(left, left.getPages()[0].id, { [collection.id]: darkId })
    const saved = await open(await exportFigFile(left))
    expect(fillOf(await exportFigFile(saved), 'On page')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    setMode(saved, layerNamed(saved, 'Holder').id, { [collection.id]: darkId })
    saved.reparentNode(layerNamed(saved, 'Inner').id, saved.getPages()[0].id)
    expect(fillOf(await exportFigFile(saved), 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    // A new default mode reaches layers with no mode of their own.
    const defaults = await open(bytes)
    populateFigInternalPages(defaults)
    setDefaultMode(defaults, collection.id, darkId)
    reconcileVariableLayouts(defaults, { variables: [surface.id] })
    const defaultDark = await exportFigFile(defaults)
    expect(fillOf(defaultDark, 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(fillOf(defaultDark, 'Internal')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('saves a bound paint a variable refreshed, though the variable is back as it was', async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const modeId = collection.defaultModeId
    const brand = source.createVariable('brand', 'COLOR', collection.id, { r: 0, g: 0, b: 1, a: 1 })
    const card = source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: 'Card',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    source.bindVariable(card.id, 'fills/0/color', brand.id)
    // The paint's opacity was edited after it bound, which Figma keeps until the color changes.
    source.updateNode(card.id, { fills: [{ ...card.fills[0], opacity: 0.4 }] })
    const bytes = await exportFigFile(source)

    const graph = await open(bytes)
    // As a collaborator's values arrive: written into the variable, then reconciled.
    const setBrand = (color: Color) => {
      expectDefined(graph.variables.get(brand.id)).valuesByMode[modeId] = color
      reconcileVariableLayouts(graph, { variables: [brand.id] })
    }
    setBrand({ r: 1, g: 0, b: 0, a: 1 })
    expect(layerNamed(graph, 'Card').fills[0]).toMatchObject({
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1
    })
    setBrand({ r: 0, g: 0, b: 1, a: 1 })
    // Each change refreshed the paint, discarding its edit, as Figma does.
    expect(layerNamed(graph, 'Card').fills[0]).toMatchObject({
      color: { r: 0, g: 0, b: 1, a: 1 },
      opacity: 1
    })

    const saved = [...recordsOf(await exportFigFile(graph)).values()]
    const record = expectDefined(saved.find((entry) => entry.name === 'Card'))
    expect(record.fillPaints?.[0]).toMatchObject({ color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1 })
  })

  test('rewrites the variables when one changes', async () => {
    const { patched } = await exportBothWays((graph) => {
      const [variable] = graph.variables.values()
      const [modeId] = Object.keys(variable.valuesByMode)
      variable.valuesByMode[modeId] = { r: 0, g: 0, b: 1, a: 1 }
    })
    const reopened = await open(patched)
    const [variable] = reopened.variables.values()
    expect(Object.values(variable.valuesByMode)[0]).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    expect(reopened.variables.size).toBe(1)
  })
})

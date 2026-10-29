import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

describe('instance descendant fill override round trip', () => {
  test('a recolored nested instance child keeps its color after a save/reload cycle', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon' })
    const path = graph.createNode('VECTOR', icon.id, {
      name: 'path',
      width: 16,
      height: 16,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const instance = graph.createInstance(icon.id, page.id)
    if (!instance) throw new Error('failed to create instance')
    const instancePath = graph.getChildren(instance.id)[0]
    expect(instancePath.componentId).toBe(path.id)

    graph.updateNode(instancePath.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const { recordInstanceOverride } = await import('@open-pencil/scene-graph/instances')
    recordInstanceOverride(graph, instancePath.id, ['fills'])

    const exported = await exportFigFile(graph)
    const reloaded = await parseFigFile(exported.buffer as ArrayBuffer)

    const reloadedInstance = [...reloaded.getAllNodes()].find((n) => n.type === 'INSTANCE')
    expect(reloadedInstance).toBeDefined()
    const reloadedPath = reloadedInstance ? reloaded.getChildren(reloadedInstance.id)[0] : undefined
    expect(reloadedPath?.fills[0]?.color).toEqual({ r: 0, g: 0, b: 1, a: 1 })

    const reloadedIcon = [...reloaded.getAllNodes()].find(
      (n) => n.type === 'COMPONENT' && n.name === 'Icon'
    )
    const reloadedIconPath = reloadedIcon ? reloaded.getChildren(reloadedIcon.id)[0] : undefined
    expect(reloadedIconPath?.fills[0]?.color).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('a literal fill over a nested instance fill bound to a variable stays after reload', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Tokens')
    const accent = graph.createVariable('accent-soft', 'COLOR', collection.id, {
      r: 0.84,
      g: 0.93,
      b: 0.91,
      a: 1
    })
    const solid = (color: Color, opacity = 1) => [
      { type: 'SOLID' as const, color, opacity, visible: true }
    ]
    const button = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      width: 80,
      height: 30,
      fills: solid({ r: 0.13, g: 0.33, b: 0.8, a: 1 })
    })
    const card = graph.createNode('COMPONENT', page.id, { name: 'Card', x: 200 })
    const nested = graph.createInstance(button.id, card.id)
    if (!nested) throw new Error('failed to create the nested instance')
    graph.bindVariable(nested.id, 'fills/0/color', accent.id)
    const use = graph.createInstance(card.id, page.id, { name: 'Use', y: 100 })
    if (!use) throw new Error('failed to create the instance')
    const copy = graph.getChildren(use.id)[0]
    graph.updateNode(copy.id, {
      fills: solid({ r: 0, g: 0, b: 0, a: 0 }, 0),
      boundVariables: {}
    })
    const { recordInstanceOverride } = await import('@open-pencil/scene-graph/instances')
    recordInstanceOverride(graph, copy.id, ['fills', 'boundVariables'])

    const reloaded = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reloadedUse = [...reloaded.getAllNodes()].find((node) => node.name === 'Use')
    const reloadedCopy = reloadedUse ? reloaded.getChildren(reloadedUse.id)[0] : undefined
    if (!reloadedUse || !reloadedCopy) throw new Error('Missing the reloaded copy')
    // A sync, as editing the component would run, keeps the claim too.
    reloaded.syncInstance(reloadedUse.id)
    const synced = reloaded.getNode(reloadedCopy.id)
    expect(synced?.fills[0]).toMatchObject({ color: { r: 0, g: 0, b: 0, a: 0 }, opacity: 0 })
    expect(synced?.boundVariables['fills/0/color']).toBeUndefined()
    // Resetting the overrides brings back the binding the card gives its button.
    reloaded.updateNode(reloadedUse.id, {
      instanceOverrides: { self: new Map(), descendants: new Map() }
    })
    reloaded.updateNode(reloadedCopy.id, {
      instanceOverrides: { self: new Map(), descendants: new Map() }
    })
    reloaded.syncInstance(reloadedUse.id)
    const reset = reloaded.getNode(reloadedCopy.id)?.boundVariables['fills/0/color']
    expect(reset ? reloaded.variables.get(reset)?.name : reset).toBe('accent-soft')
  })

  test('a variable an outer instance binds over a nested literal fill stays after reload', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Tokens')
    const accent = graph.createVariable('accent-soft', 'COLOR', collection.id, {
      r: 0.84,
      g: 0.93,
      b: 0.91,
      a: 1
    })
    const solid = (color: Color) => [{ type: 'SOLID' as const, color, opacity: 1, visible: true }]
    const button = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      width: 80,
      height: 30,
      fills: solid({ r: 0.13, g: 0.33, b: 0.8, a: 1 })
    })
    const card = graph.createNode('COMPONENT', page.id, { name: 'Card', x: 200 })
    const nested = graph.createInstance(button.id, card.id)
    if (!nested) throw new Error('failed to create the nested instance')
    const { recordInstanceOverride } = await import('@open-pencil/scene-graph/instances')
    // The card's button is red; the instance of the card binds that button to a token.
    graph.updateNode(nested.id, { fills: solid({ r: 0.9, g: 0.1, b: 0.1, a: 1 }) })
    recordInstanceOverride(graph, nested.id, ['fills'])
    const use = graph.createInstance(card.id, page.id, { name: 'Use', y: 100 })
    if (!use) throw new Error('failed to create the instance')
    const copy = graph.getChildren(use.id)[0]
    graph.updateNode(copy.id, { fills: solid({ r: 0.84, g: 0.93, b: 0.91, a: 1 }) })
    graph.bindVariable(copy.id, 'fills/0/color', accent.id)
    recordInstanceOverride(graph, copy.id, ['fills', 'boundVariables'])

    const reloaded = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reloadedUse = [...reloaded.getAllNodes()].find((node) => node.name === 'Use')
    const reloadedCopy = reloadedUse ? reloaded.getChildren(reloadedUse.id)[0] : undefined
    if (!reloadedUse || !reloadedCopy) throw new Error('Missing the reloaded copy')
    reloaded.syncInstance(reloadedUse.id)
    const bound = reloaded.getNode(reloadedCopy.id)?.boundVariables['fills/0/color']
    expect(bound ? reloaded.variables.get(bound)?.name : undefined).toBe('accent-soft')
  })
})

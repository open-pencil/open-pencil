import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import {
  createLibraryRevision,
  materializeLibraryAsset,
  updateLibraryDefinitions
} from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { isLibraryCollection, SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { expectDefined } from '@open-pencil/test-support/assert'

const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }

function solid(): Fill {
  return { type: 'SOLID', color: RED, opacity: 1, visible: true }
}

/** A library whose two components bind one token through an alias and share a style. */
function library() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const primitives = graph.createCollection('Primitives')
  const semantic = graph.createCollection('Semantic')
  const red = graph.createVariable('red', 'COLOR', primitives.id, RED)
  const accent = graph.createVariable('accent', 'COLOR', semantic.id, { aliasId: red.id })
  const style = graph.createNode('RECTANGLE', page.id, {
    name: 'Outline',
    sharedStyleType: 'FILL',
    fills: [solid()]
  })
  style.source.id = 'S:outline,'
  const component = (name: string) => {
    const node = graph.createNode('COMPONENT', page.id, {
      name,
      componentKey: name.toLowerCase(),
      fills: [solid()],
      strokeStyleId: 'S:outline,'
    })
    graph.bindVariable(node.id, 'fills/0/color', accent.id)
    return node
  }
  component('Button')
  component('Badge')
  return { graph, primitives, red }
}

const publish = (graph: SceneGraph, previousRevisionId: string | null = null) =>
  createLibraryRevision({ libraryId: 'ds', name: 'DS', graph, previousRevisionId })

function bound(consumer: SceneGraph, componentId: string): string | undefined {
  return consumer.getNode(componentId)?.boundVariables['fills/0/color']
}

describe('inserting library components', () => {
  test('brings the tokens a component binds as the library’s collections', async () => {
    const { graph } = library()
    const consumer = new SceneGraph()
    const own = consumer.createCollection('Mine')

    const { componentId } = materializeLibraryAsset(consumer, await publish(graph), 'button')

    const variable = consumer.variables.get(bound(consumer, componentId) ?? '')
    expect(variable?.name).toBe('accent')
    expect(consumer.resolveColorVariable(variable?.id ?? '')).toEqual(RED)
    const collections = [...consumer.variableCollections.values()]
    expect(collections.map((collection) => collection.name).sort()).toEqual([
      'Mine',
      'Primitives',
      'Semantic'
    ])
    expect(
      collections
        .filter(isLibraryCollection)
        .map((collection) => collection.name)
        .sort()
    ).toEqual(['Primitives', 'Semantic'])
    expect(isLibraryCollection(own)).toBe(false)
  })

  test('reuses the collections and styles an earlier insert brought', async () => {
    const { graph } = library()
    const revision = await publish(graph)
    const consumer = new SceneGraph()

    const button = materializeLibraryAsset(consumer, revision, 'button')
    const badge = materializeLibraryAsset(consumer, revision, 'badge')

    expect(consumer.variableCollections.size).toBe(2)
    expect(consumer.variables.size).toBe(2)
    expect(bound(consumer, badge.componentId)).toBe(bound(consumer, button.componentId))
    const styles = getSharedStyles(consumer, 'fill')
    expect(styles.map((style) => style.name)).toEqual(['Outline'])
    expect(consumer.getNode(button.componentId)?.strokeStyleId).toBe(styles[0].id)
    expect(consumer.getNode(badge.componentId)?.strokeStyleId).toBe(styles[0].id)
    expect(consumer.getNode(styles[0].nodeId)?.librarySource?.readOnly).toBe(true)
  })

  test('brings the styles of a library read from a file', async () => {
    await initCodec()
    const { graph } = library()
    const file = await parseFigFile((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
    const consumer = new SceneGraph()

    const { componentId } = materializeLibraryAsset(consumer, await publish(file), 'button')

    const styles = getSharedStyles(consumer, 'fill')
    expect(styles.map((style) => style.name)).toEqual(['Outline'])
    expect(consumer.getNode(componentId)?.strokeStyleId).toBe(styles[0].id)
  })

  test('takes a library update’s token values into the collections it brought', async () => {
    const { graph, primitives, red } = library()
    const first = await publish(graph)
    const consumer = new SceneGraph()
    const { componentId } = materializeLibraryAsset(consumer, first, 'button')
    graph.variables.set(red.id, { ...red, valuesByMode: { [primitives.defaultModeId]: BLUE } })

    updateLibraryDefinitions(consumer, await publish(graph, first.manifest.revisionId))

    expect(consumer.variableCollections.size).toBe(2)
    expect(consumer.resolveColorVariable(bound(consumer, componentId) ?? '')).toEqual(BLUE)
  })

  test('moves to the revision once its components are updated, leaving out the styles it brought', async () => {
    const { graph } = library()
    const first = await publish(graph)
    const consumer = new SceneGraph()
    materializeLibraryAsset(consumer, first, 'button')
    const button = [...graph.getAllNodes()].find((node) => node.componentKey === 'button')
    graph.updateNode(button?.id ?? '', { strokeStyleId: null })
    const next = await publish(graph, first.manifest.revisionId)

    const update = updateLibraryDefinitions(consumer, next, { assetKeys: new Set(['button']) })

    expect(update.behind).toEqual([])
    expect(consumer.enabledLibraries.get('ds')?.revisionId).toBe(next.manifest.revisionId)
  })

  test('sizes the instances of a component bound to a size token the update changes', async () => {
    const graph = new SceneGraph()
    const sizes = graph.createCollection('Sizes')
    const wide = graph.createVariable('wide', 'FLOAT', sizes.id, 120)
    const button = graph.createNode('COMPONENT', graph.getPages()[0].id, {
      name: 'Button',
      componentKey: 'button',
      width: 120,
      height: 40
    })
    graph.bindVariable(button.id, 'width', wide.id)
    const first = await publish(graph)
    const consumer = new SceneGraph()
    const { componentId } = materializeLibraryAsset(consumer, first, 'button')
    const instance = consumer.createInstance(componentId, consumer.getPages()[0].id)
    graph.variables.set(wide.id, { ...wide, valuesByMode: { [sizes.defaultModeId]: 200 } })

    updateLibraryDefinitions(consumer, await publish(graph, first.manifest.revisionId))

    expect(consumer.getNode(componentId)?.width).toBe(200)
    expect(consumer.getNode(instance?.id ?? '')?.width).toBe(200)
  })
})

describe('renaming a library mode', () => {
  test('renames the copy in place, so its layers and the document keep following the library', async () => {
    const GREEN = { r: 0, g: 1, b: 0, a: 1 }
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const theme = graph.createCollection('Theme')
    const light = theme.defaultModeId
    graph.renameMode(theme.id, light, 'Light')
    const dark = expectDefined(graph.createMode(theme.id, 'Dark'), 'library dark mode')
    const surface = graph.createVariable('surface', 'COLOR', theme.id, RED)
    graph.variables.set(surface.id, { ...surface, valuesByMode: { [light]: RED, [dark]: BLUE } })
    const button = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      componentKey: 'button',
      fills: [solid()]
    })
    graph.bindVariable(button.id, 'fills/0/color', surface.id)
    const first = await publish(graph)

    const consumer = new SceneGraph()
    materializeLibraryAsset(consumer, first, 'button')
    const copy = expectDefined(
      [...consumer.variableCollections.values()].find(isLibraryCollection),
      'collection copy'
    )
    const copyDark = expectDefined(
      copy.modes.find((mode) => mode.name === 'Dark'),
      'dark copy'
    )
    expect(copyDark.libraryModeId).toBe(dark)
    consumer.setActiveMode(copy.id, copyDark.modeId)
    const copySurface = expectDefined(
      [...consumer.variables.values()].find((variable) => variable.name === 'surface'),
      'surface copy'
    )

    // The library renames Dark to Night and gives it another value.
    graph.renameMode(theme.id, dark, 'Night')
    const changed = graph.variables.get(surface.id) ?? surface
    graph.variables.set(surface.id, { ...changed, valuesByMode: { [light]: RED, [dark]: GREEN } })

    updateLibraryDefinitions(consumer, await publish(graph, first.manifest.revisionId))

    const updated = consumer.variableCollections.get(copy.id)
    expect(updated?.modes.map((mode) => mode.name)).toEqual(['Light', 'Night'])
    // The renamed mode is the one the document had, so its layers and choice still hold.
    expect(updated?.modes.find((mode) => mode.name === 'Night')?.modeId).toBe(copyDark.modeId)
    expect(consumer.activeMode.get(copy.id)).toBe(copyDark.modeId)
    expect(consumer.resolveColorVariable(copySurface.id)).toEqual(GREEN)
  })
})

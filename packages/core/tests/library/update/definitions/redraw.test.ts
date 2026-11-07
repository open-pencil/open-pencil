import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import {
  createLibraryRevision,
  materializeLibraryAsset,
  updateLibraryDefinitions
} from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { applyComponentPropertyValue } from '@open-pencil/scene-graph/components'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

/** A library whose button holds an icon and a label, and whose card holds a relabeled button. */
function library() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const icon = graph.createNode('COMPONENT', page.id, {
    name: 'Icon',
    componentKey: 'icon',
    x: 200
  })
  graph.createNode('ELLIPSE', icon.id, { name: 'Glyph', width: 16, height: 16 })
  const button = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    cornerRadius: 4
  })
  graph.createInstance(icon.id, button.id)
  graph.createNode('TEXT', button.id, { name: 'Label', text: 'Button' })
  const card = graph.createNode('COMPONENT', page.id, {
    name: 'Card',
    componentKey: 'card',
    y: 100
  })
  const remove = graph.createInstance(button.id, card.id, { name: 'Remove' })
  if (!remove) throw new Error('Expected the card button')
  relabel(graph, remove.id, 'Remove')
  return { graph, page, button, icon }
}

/** The graph a saved .fig gives back, whose overrides name the component layers they change. */
async function reopened(graph: SceneGraph): Promise<SceneGraph> {
  await initCodec()
  const bytes = await exportFigFile(graph)
  const read = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
  populateAllFigPages(read)
  return read
}

const revisionOf = (graph: SceneGraph) =>
  createLibraryRevision({ libraryId: 'design-system', name: 'Design system', graph })

function layer(graph: SceneGraph, parentId: string, name: string): SceneNode {
  const found = graph.getChildren(parentId).find((node) => node.name === name)
  if (!found) throw new Error(`Expected ${name} in ${parentId}`)
  return found
}

function relabel(graph: SceneGraph, buttonId: string, text: string): void {
  const label = layer(graph, buttonId, 'Label')
  graph.updateNode(label.id, { text })
  recordInstanceOverride(graph, label.id, ['text'])
}

/** A document that uses the button directly, and through a local component that holds one. */
async function document(source: SceneGraph) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const { componentId } = materializeLibraryAsset(graph, await revisionOf(source), 'button')
  const sidebar = graph.createNode('COMPONENT', page.id, { name: 'Sidebar', x: 400 })
  const held = graph.createInstance(componentId, sidebar.id, { name: 'Home' })
  if (!held) throw new Error('Expected the held button')
  relabel(graph, held.id, 'Home')
  const direct = graph.createInstance(componentId, page.id, { name: 'Save' })
  if (!direct) throw new Error('Expected the button')
  relabel(graph, direct.id, 'Save')
  const placed = graph.createInstance(sidebar.id, page.id, { name: 'Placed', y: 200 })
  if (!placed) throw new Error('Expected the sidebar')
  const copy = layer(graph, placed.id, 'Home')
  relabel(graph, copy.id, 'Start')
  return { graph, componentId, held, direct, copy }
}

describe('library definition updates', () => {
  test('keeps each copy of a definition pointing into its own layers', async () => {
    const source = await reopened(library().graph)
    const graph = new SceneGraph()
    const first = await revisionOf(source)
    // The card brings its own copy of the button, apart from the one materialized before it.
    materializeLibraryAsset(graph, first, 'button')
    const { componentId: cardId } = materializeLibraryAsset(graph, first, 'card')
    const button = [...source.getAllNodes()].find((node) => node.componentKey === 'button')
    source.updateNode(button?.id ?? '', { cornerRadius: 12 })
    updateLibraryDefinitions(graph, await revisionOf(source))

    const remove = layer(graph, cardId, 'Remove')
    const named = [...remove.instanceOverrides.descendants.values()].flatMap((fields) => {
      const id = fields.get('sourceComponentId')
      return typeof id === 'string' ? [id] : []
    })
    expect(named.length).toBeGreaterThan(0)
    for (const id of named) expect(graph.isDescendant(id, remove.componentId ?? '')).toBe(true)
    expect(layer(graph, remove.id, 'Label').text).toBe('Remove')
  })

  test('pairs a saved document’s definitions with the next revision by the library layers they copy', async () => {
    const source = await reopened(library().graph)
    const doc = await document(source)
    const saved = await reopened(doc.graph)
    const definition = saved.getNode(doc.componentId)
    expect(definition?.libraryLayerId).toBeTruthy()
    expect(saved.getChildren(doc.componentId).every((node) => node.libraryLayerId)).toBe(true)

    const button = [...source.getAllNodes()].find((node) => node.componentKey === 'button')
    // A revision follows what a layer draws, not its name, so the rename comes with a new radius.
    source.updateNode(layer(source, button?.id ?? '', 'Label').id, { name: 'Caption' })
    source.updateNode(button?.id ?? '', { cornerRadius: 12 })
    updateLibraryDefinitions(saved, await revisionOf(source))

    const direct = [...saved.getAllNodes()].find((node) => node.name === 'Save')
    expect(layer(saved, direct?.id ?? '', 'Caption').text).toBe('Save')
  })

  test('redraws a definition in place, keeping every instance and copy with its overrides', async () => {
    const source = library()
    const doc = await document(source.graph)
    const definitionIds = [
      doc.componentId,
      ...doc.graph.getChildren(doc.componentId).map((node) => node.id)
    ]

    source.graph.updateNode(source.button.id, { cornerRadius: 12 })
    source.graph.createNode('RECTANGLE', source.button.id, { name: 'Badge', width: 6, height: 6 })
    const revision = await revisionOf(source.graph)
    const result = updateLibraryDefinitions(doc.graph, revision)

    // The icon the button holds is a definition of its own, at the same revision.
    expect([...result.updated].sort()).toEqual(['button', 'icon'])
    expect([...result.replaced, ...result.missing]).toEqual([])
    expect(doc.graph.getNode(doc.componentId)?.librarySource?.identity.revisionId).toBe(
      revision.manifest.revisionId
    )
    expect(definitionIds.every((id) => doc.graph.getNode(id))).toBe(true)
    for (const [button, text] of [
      [doc.direct, 'Save'],
      [doc.held, 'Home'],
      [doc.copy, 'Start']
    ] as const) {
      expect(doc.graph.getNode(button.id)?.cornerRadius).toBe(12)
      expect(layer(doc.graph, button.id, 'Label').text).toBe(text)
      expect(layer(doc.graph, button.id, 'Badge').width).toBe(6)
    }
    expect(doc.graph.enabledLibraries.get('design-system')?.revisionId).toBe(
      revision.manifest.revisionId
    )
  })

  test('removes the layers a revision drops and brings in the components it starts using', async () => {
    const source = library()
    const doc = await document(source.graph)

    const icon = source.graph.getChildren(source.button.id).find((node) => node.type === 'INSTANCE')
    if (!icon) throw new Error('Expected the icon')
    source.graph.deleteNode(icon.id)
    const dot = source.graph.createNode('COMPONENT', source.page.id, {
      name: 'Dot',
      componentKey: 'dot',
      x: 300
    })
    source.graph.createNode('ELLIPSE', dot.id, { name: 'Fill', width: 4, height: 4 })
    source.graph.createInstance(dot.id, source.button.id)
    updateLibraryDefinitions(doc.graph, await revisionOf(source.graph))

    for (const button of [doc.direct, doc.held, doc.copy]) {
      const names = doc.graph.getChildren(button.id).map((node) => node.name)
      expect(names).toEqual(['Label', 'Dot'])
      const dotCopy = layer(doc.graph, button.id, 'Dot')
      expect(layer(doc.graph, dotCopy.id, 'Fill').width).toBe(4)
    }
    const definition = layer(doc.graph, doc.componentId, 'Dot')
    expect(doc.graph.getNode(definition.componentId ?? '')?.librarySource?.identity.assetKey).toBe(
      'dot'
    )
  })

  test("points instance-swap properties at the document's copies of their components", async () => {
    const source = new SceneGraph()
    const page = source.getPages()[0]
    const star = source.createNode('COMPONENT', page.id, { name: 'Star', componentKey: 'star' })
    const heart = source.createNode('COMPONENT', page.id, { name: 'Heart', componentKey: 'heart' })
    const button = source.createNode('COMPONENT', page.id, {
      name: 'Button',
      componentKey: 'button',
      componentPropertyDefinitions: [
        { id: 'icon', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: star.id }
      ]
    })
    const icon = source.createInstance(star.id, button.id)
    if (!icon) throw new Error('Expected the icon instance')
    source.updateNode(icon.id, {
      componentPropertyReferences: [{ propertyId: 'icon', field: 'INSTANCE_SWAP' }]
    })
    const card = source.createNode('COMPONENT', page.id, { name: 'Card', componentKey: 'card' })
    const cardButton = source.createInstance(button.id, card.id)
    const property = source.getNode(button.id)?.componentPropertyDefinitions[0]
    if (!cardButton || !property) throw new Error('Expected the card button and its property')
    applyComponentPropertyValue(source, cardButton.id, property, heart.id)
    const graph = new SceneGraph()
    const { componentId: cardId } = materializeLibraryAsset(graph, await revisionOf(source), 'card')

    source.updateNode(button.id, { cornerRadius: 12 })
    updateLibraryDefinitions(graph, await revisionOf(source))

    const asset = (id: string | undefined) =>
      graph.getNode(id ?? '')?.librarySource?.identity.assetKey
    const inserted = graph.getChildren(cardId)[0]
    const definition = graph.getNode(inserted?.componentId ?? '')
    expect(definition?.cornerRadius).toBe(12)
    expect(asset(definition?.componentPropertyDefinitions[0]?.defaultValue)).toBe('star')
    expect(asset(inserted?.componentPropertyAssignments.icon)).toBe('heart')
  })

  test('redraws only the assets asked for, moving the document to the revision once none is behind', async () => {
    const source = library()
    const doc = await document(source.graph)
    const first = doc.graph.enabledLibraries.get('design-system')?.revisionId
    source.graph.updateNode(source.button.id, { cornerRadius: 12 })
    source.graph.updateNode(layer(source.graph, source.icon.id, 'Glyph').id, { width: 20 })
    const revision = await revisionOf(source.graph)
    const definitionOf = (key: string) =>
      [...doc.graph.getAllNodes()].find(
        (node) => node.librarySource?.identity.assetKey === key && node.type === 'COMPONENT'
      )
    const iconBefore = definitionOf('icon')

    const partial = updateLibraryDefinitions(doc.graph, revision, {
      assetKeys: new Set(['button'])
    })
    expect(partial.updated).toEqual(['button'])
    expect(partial.behind).toEqual(['icon'])
    expect(doc.graph.getNode(doc.componentId)?.cornerRadius).toBe(12)
    expect(iconBefore?.librarySource?.identity.revisionId).toBe(first)
    expect(doc.graph.enabledLibraries.get('design-system')?.revisionId).toBe(first)

    updateLibraryDefinitions(doc.graph, revision)
    expect(doc.graph.enabledLibraries.get('design-system')?.revisionId).toBe(
      revision.manifest.revisionId
    )
  })

  test.each([
    ['button', 'icon'],
    ['icon', 'button']
  ])(
    'keeps one definition of the icon the button draws, updating the %s and then the %s',
    async (first: string, then: string) => {
      const source = library()
      const doc = await document(source.graph)
      source.graph.updateNode(source.button.id, { cornerRadius: 12 })
      source.graph.updateNode(layer(source.graph, source.icon.id, 'Glyph').id, { width: 20 })
      const revision = await revisionOf(source.graph)
      const icons = () =>
        [...doc.graph.getAllNodes()]
          .filter(
            (node) => node.type === 'COMPONENT' && node.librarySource?.identity.assetKey === 'icon'
          )
          .map((node) => node.id)
      const [icon] = icons()
      const drawn = () =>
        doc.graph.getChildren(doc.componentId).find((node) => node.type === 'INSTANCE')
          ?.componentId

      for (const assetKey of [first, then]) {
        updateLibraryDefinitions(doc.graph, revision, { assetKeys: new Set([assetKey]) })
        expect(icons()).toEqual([icon])
        expect(drawn()).toBe(icon)
      }
      expect(layer(doc.graph, icon ?? '', 'Glyph').width).toBe(20)
    }
  )

  test('keeps the document on its revision while the revision draws a definition as another kind of layer', async () => {
    const source = library()
    const doc = await document(source.graph)
    const first = doc.graph.enabledLibraries.get('design-system')?.revisionId
    // The library turns its icon into the one variant of a set.
    const set = source.graph.createNode('COMPONENT_SET', source.page.id, {
      name: 'Icon',
      componentKey: 'icon'
    })
    source.graph.updateNode(source.icon.id, { name: 'Size=Large', componentKey: 'icon-large' })
    source.graph.insertChildAt(source.icon.id, set.id, 0)

    const result = updateLibraryDefinitions(doc.graph, await revisionOf(source.graph))
    expect(result.replaced).toEqual(['icon'])
    expect(doc.graph.enabledLibraries.get('design-system')?.revisionId).toBe(first)
  })

  describe('variants', () => {
    /** A library whose chip set has a Default and a Hover variant, neither of them keyed. */
    function chips() {
      const graph = new SceneGraph()
      const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
        name: 'Chip',
        componentKey: 'chip'
      })
      const variants = Object.fromEntries(
        ['Default', 'Hover'].map((state) => {
          const variant = graph.createNode('COMPONENT', set.id, { name: `State=${state}` })
          graph.createNode('TEXT', variant.id, { name: 'Label', text: state })
          return [state, variant.id]
        })
      )
      return { graph, variants }
    }

    async function placed(library: SceneGraph, variant: string) {
      const graph = new SceneGraph()
      const { componentSetId } = materializeLibraryAsset(graph, await revisionOf(library), 'chip')
      const component = layer(graph, componentSetId ?? '', `State=${variant}`)
      const instance = graph.createInstance(component.id, graph.getPages()[0].id)
      if (!instance) throw new Error('Expected the instance')
      return { graph, instance: instance.id }
    }

    test('keeps the instances of a variant the library renames', async () => {
      const library = chips()
      const { graph, instance } = await placed(library.graph, 'Hover')
      library.graph.updateNode(library.variants.Hover ?? '', { name: 'State=Pressed' })
      const label = layer(library.graph, library.variants.Hover ?? '', 'Label')
      library.graph.updateNode(label.id, { text: 'Pressed' })
      updateLibraryDefinitions(graph, await revisionOf(library.graph))

      const component = graph.getNode(graph.getNode(instance)?.componentId ?? '')
      expect(component?.name).toBe('State=Pressed')
      expect(layer(graph, instance, 'Label').text).toBe('Pressed')
    })

    test('keeps a variant the library drops while an instance draws it', async () => {
      const library = chips()
      const { graph, instance } = await placed(library.graph, 'Hover')
      library.graph.deleteNode(library.variants.Hover ?? '')
      updateLibraryDefinitions(graph, await revisionOf(library.graph))

      expect(graph.getNode(graph.getNode(instance)?.componentId ?? '')?.name).toBe('State=Hover')
    })
  })

  test('brings in the images a revision adds', async () => {
    const source = library()
    const doc = await document(source.graph)
    const hash = 'a'.repeat(40)
    source.graph.images.set(hash, new Uint8Array([1, 2, 3]))
    source.graph.updateNode(source.button.id, {
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          imageHash: hash,
          imageScaleMode: 'FILL',
          opacity: 1,
          visible: true
        }
      ]
    })
    updateLibraryDefinitions(doc.graph, await revisionOf(source.graph))

    expect(doc.graph.getNode(doc.componentId)?.fills[0]?.imageHash).toBe(hash)
    expect(doc.graph.images.get(hash)).toEqual(new Uint8Array([1, 2, 3]))
  })
})

import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  createLibraryRevision,
  deserializeLibraryRevision,
  encodeStoredLibraryRevision,
  materializeLibraryAsset,
  storedLibraryRevisionSchema
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

/** A library whose button holds an icon instance that overrides its glyph's opacity. */
function libraryWithOverride(opacity: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon', componentKey: 'icon' })
  graph.createNode('ELLIPSE', icon.id, { name: 'Glyph' })
  const button = graph.createNode('COMPONENT', page.id, { name: 'Button', componentKey: 'button' })
  const nested = graph.createInstance(icon.id, button.id)
  const glyph = nested ? graph.getChildren(nested.id)[0] : undefined
  if (!glyph) throw new Error('Expected the nested icon copy')
  graph.updateNode(glyph.id, { opacity })
  recordInstanceOverride(graph, glyph.id, ['opacity'])
  return { graph, button }
}

const revisionOf = (graph: SceneGraph) =>
  createLibraryRevision({ libraryId: 'design-system', name: 'Design system', graph })

/** The nested icon instance of a button, and its glyph copy. */
function nestedIcon(graph: SceneGraph, buttonId: string) {
  const nested = graph.getChildren(buttonId).find((node) => node.type === 'INSTANCE')
  const glyph = nested ? graph.getChildren(nested.id)[0] : undefined
  if (!nested || !glyph) throw new Error('Expected the nested icon and its glyph')
  return { nested, glyph }
}

describe('instance overrides in library revisions', () => {
  test('keeps them, under the IDs of the stored layers, through a revision stored as JSON', async () => {
    const { graph } = libraryWithOverride(0.5)
    const revision = await revisionOf(graph)
    // A catalog that stores revisions as JSON, as files and remote storage do.
    const stored = v.parse(
      v.pipe(v.string(), v.parseJson(), storedLibraryRevisionSchema),
      JSON.stringify(encodeStoredLibraryRevision(revision))
    )
    const restored = deserializeLibraryRevision(stored).graph
    const button = [...restored.getAllNodes()].find((node) => node.componentKey === 'button')
    const { nested, glyph } = nestedIcon(restored, button?.id ?? '')

    expect([...nested.instanceOverrides.descendants.keys()]).toEqual([glyph.id])
    expect(nested.instanceOverrides.descendants.get(glyph.id)?.has('opacity')).toBe(true)
  })

  test('keeps them under the IDs of the materialized layers', async () => {
    const { graph } = libraryWithOverride(0.25)
    const consumer = new SceneGraph()
    const { componentId } = materializeLibraryAsset(consumer, await revisionOf(graph), 'button')
    const { nested, glyph } = nestedIcon(consumer, componentId)

    expect([...nested.instanceOverrides.descendants.keys()]).toEqual([glyph.id])
    // A sync, as reopening the file runs, keeps the overridden value.
    consumer.syncInstance(nested.id)
    expect(consumer.getNode(glyph.id)?.opacity).toBe(0.25)
  })
})

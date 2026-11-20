import type { SceneGraph } from '@open-pencil/scene-graph'

function collectionWithTwoModes(graph: SceneGraph, name: string, first: string, second: string) {
  const collection = graph.createCollection(name)
  graph.renameMode(collection.id, collection.defaultModeId, first)
  const secondMode = graph.createMode(collection.id, second)
  if (!secondMode) {
    throw new Error('Expected a second mode')
  }
  return { collection, secondMode }
}

/** The layers a mode badge reads from. */
export interface LayersWithModes {
  /** A layer with modes in four collections, two of them named alike. */
  frameId: string
  /** A layer with one mode. */
  singleId: string
  /** The second of the two collections named alike. */
  copyId: string
}

/**
 * A layer named `name` with a mode in each of four collections, two of them named Theme, and a
 * layer named Single with one mode.
 */
export function createLayersWithModes(
  graph: SceneGraph,
  pageId: string,
  name: string
): LayersWithModes {
  const theme = collectionWithTwoModes(graph, 'Theme', 'Light', 'Dark')
  const themeCopy = {
    ...structuredClone(theme.collection),
    id: `${theme.collection.id}-copy`,
    variableIds: [],
    modes: theme.collection.modes.map((mode) => ({ ...mode, name: `${mode.name} alt` }))
  }
  graph.addCollection(themeCopy)
  const density = collectionWithTwoModes(graph, 'Density', 'Comfortable', 'Compact')
  const size = collectionWithTwoModes(graph, 'Size', 'Small', 'Large')
  const frame = graph.createNode('FRAME', pageId, {
    name,
    x: 100,
    y: 100,
    width: 200,
    height: 160,
    variableModes: {
      [theme.collection.id]: theme.secondMode,
      [themeCopy.id]: theme.collection.defaultModeId,
      [density.collection.id]: density.secondMode,
      [size.collection.id]: size.secondMode
    }
  })
  const single = graph.createNode('FRAME', pageId, {
    name: 'Single',
    x: 400,
    y: 100,
    width: 200,
    height: 160,
    variableModes: { [density.collection.id]: density.secondMode }
  })
  return { frameId: frame.id, singleId: single.id, copyId: themeCopy.id }
}

const DEEP_LAYER_DEPTH = 10

/** A layer named A with one mode, ten frames deep; returns its id. */
export function createDeepLayerWithMode(graph: SceneGraph, pageId: string): string {
  const spacing = collectionWithTwoModes(graph, 'Spacing', 'Tight', 'Loose')
  let parentId = pageId
  for (let depth = 0; depth < DEEP_LAYER_DEPTH; depth++) {
    parentId = graph.createNode('FRAME', parentId, { name: 'G', width: 100, height: 100 }).id
  }
  return graph.createNode('FRAME', parentId, {
    name: 'A',
    width: 20,
    height: 20,
    variableModes: { [spacing.collection.id]: spacing.secondMode }
  }).id
}

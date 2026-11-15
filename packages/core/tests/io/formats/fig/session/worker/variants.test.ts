import { expect, test } from 'bun:test'

import {
  libraryVariantFile,
  pageInstance,
  setNamed,
  STATES,
  switchToDisabled
} from '#core-tests/helpers/fig/library-variants'

import { createEditor } from '@open-pencil/core'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import {
  createFigPopulationWorker,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { populateFigInternalPages } from '#core/kiwi/fig/session/document-state'

/** The chip variants and the icon sets the graph holds, by name, to tell a variant built twice. */
function builtSets(graph: SceneGraph) {
  const internal = graph.getPages(true).find((page) => page.internalOnly)
  return {
    sets: graph.getChildren(internal?.id ?? '').map((node) => node.name),
    chip: graph.getChildren(setNamed(graph, 'Chip')?.id ?? '').map((node) => node.name)
  }
}

async function loadInternalCanvasThroughWorker(graph: SceneGraph) {
  const internal = graph.getPages(true).find((page) => page.internalOnly)
  if (!internal) throw new Error('Expected the internal canvas')
  return createFigPopulationWorker(graph)?.populate(internal.id)
}

test('a switch the panel prepares builds the variant in the reader worker', async () => {
  const bytes = (await libraryVariantFile()).slice().buffer
  const graph = await parseFigFileViaWorker(bytes, { populate: 'first-page' })
  try {
    const editor = createEditor({ graph })
    const instance = pageInstance(graph)
    const [definition] = editor.getInstanceComponentPropertyDefinitions(instance.id)
    const toLoad = editor.variantsToLoad(instance.id, definition.id, 'Disabled')
    expect(toLoad).toHaveLength(1)
    expect(await editor.loadSavedVariants(toLoad)).toBe(true)
    expect(editor.variantsToLoad(instance.id, definition.id, 'Disabled')).toEqual([])
    switchToDisabled(editor, graph)
    // The worker built it, so the switch did not take page loads off it.
    expect(createFigPopulationWorker(graph)).not.toBeNull()
    expect(await loadInternalCanvasThroughWorker(graph)).toBe(true)
    expect(builtSets(graph)).toEqual({
      sets: ['Icon', 'Chip'],
      chip: STATES.map((state) => `State=${state}`)
    })
  } finally {
    releaseFigPopulationWorker(graph)
  }
})

test('a switch built on this thread stops page loads through the worker, so none builds it twice', async () => {
  const bytes = (await libraryVariantFile()).slice().buffer
  const graph = await parseFigFileViaWorker(bytes, { populate: 'first-page' })
  try {
    switchToDisabled(createEditor({ graph }), graph)
    expect(createFigPopulationWorker(graph)).toBeNull()
    expect(populateFigInternalPages(graph)).toBe(true)
    expect(builtSets(graph)).toEqual({
      sets: ['Icon', 'Chip'],
      chip: STATES.map((state) => `State=${state}`)
    })
  } finally {
    releaseFigPopulationWorker(graph)
  }
})

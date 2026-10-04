import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  applyFigPopulationDelta,
  buildFigPopulationDelta,
  installFigMutationJournal
} from '#core/kiwi/fig/population/delta'
import { populateFigPage } from '#core/kiwi/fig/session/document-state'

function instanceNamed(graph: SceneGraph, name: string): SceneNode {
  const instance = [...graph.getAllNodes()].find(
    (node) => node.type === 'INSTANCE' && node.name === name
  )
  if (!instance) throw new Error(`Missing instance ${name}`)
  return instance
}

function labelText(graph: SceneGraph, instanceName: string): string | undefined {
  return graph.getChildren(instanceNamed(graph, instanceName).id)[0]?.text
}

function componentLabel(graph: SceneGraph): SceneNode {
  const component = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT')
  const label = component ? graph.getChildren(component.id)[0] : undefined
  if (!label) throw new Error('Missing component label')
  return label
}

async function savedDocument(instancesOnSecondPage = false): Promise<Uint8Array> {
  await initCodec()
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const component = api.createComponent()
  component.name = 'Item'
  const label = api.createText()
  label.characters = 'Default'
  component.appendChild(label)
  const edited = component.createInstance()
  edited.name = 'Edited'
  const inherited = component.createInstance()
  inherited.name = 'Inherited'
  edited.children[0].characters = 'Override'
  if (instancesOnSecondPage) {
    const page = api.createPage()
    page.name = 'Screens'
    page.appendChild(edited)
    page.appendChild(inherited)
  }
  return exportFigFile(graph)
}

function reopen(bytes: Uint8Array): Promise<SceneGraph> {
  return parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
}

async function flushComponentSync(): Promise<void> {
  await Promise.resolve()
}

describe('reopened instance overrides in a live editor', () => {
  test('keep overridden text when the editor syncs the main component and on the next reopen', async () => {
    const graph = await reopen(await savedDocument())
    expect(labelText(graph, 'Edited')).toBe('Override')

    const editor = createEditor({ graph })
    try {
      graph.updateNode(componentLabel(graph).id, { text: 'Component edit' })
      await flushComponentSync()

      expect(labelText(graph, 'Edited')).toBe('Override')
      expect(labelText(graph, 'Inherited')).toBe('Component edit')
    } finally {
      editor.dispose()
    }

    const restored = await reopen(await exportFigFile(graph))
    expect(labelText(restored, 'Edited')).toBe('Override')
    expect(labelText(restored, 'Inherited')).toBe('Component edit')
  })

  test('keep overridden text on a page populated lazily by the session worker', async () => {
    // Mirror the app: the worker keeps its own graph, the editor works on a
    // transferred copy, and later pages arrive as population deltas.
    const workerGraph = await reopen(await savedDocument(true))
    const graph = deserializeSceneGraph(structuredClone(serializeSceneGraph(workerGraph)))
    const page = graph.getPages().find((candidate) => candidate.name === 'Screens')
    if (!page) throw new Error('Missing second page')

    const editor = createEditor({ graph })
    try {
      const journal = installFigMutationJournal(workerGraph)
      try {
        expect(populateFigPage(workerGraph, page.id)).toBe(true)
        applyFigPopulationDelta(graph, buildFigPopulationDelta(workerGraph, journal, [page.id]))
      } finally {
        journal.stop()
      }
      expect(labelText(graph, 'Edited')).toBe('Override')

      graph.updateNode(componentLabel(graph).id, { text: 'Component edit' })
      await flushComponentSync()

      expect(labelText(graph, 'Edited')).toBe('Override')
      expect(labelText(graph, 'Inherited')).toBe('Component edit')
    } finally {
      editor.dispose()
    }
  })
})

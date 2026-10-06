import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/core'
import { populateFigPage } from '@open-pencil/core/io/formats/fig'

import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

import { parseFixture, VALID_NODE_TYPES } from '#tests/helpers/fig/fixtures'
import { collectAllNodes } from '#tests/helpers/fig/traversal'
import { heavy } from '#tests/helpers/test-utils'

setDefaultTimeout(180_000)

for (const { file, sourcePageId } of [
  { file: 'material3.fig', sourcePageId: '55141:14173' }, // Checkboxes
  { file: 'nuxtui.fig', sourcePageId: '69:12607' } // Button
]) {
  heavy(`incremental heavy fixture: ${file}`, () => {
    let graph: SceneGraph
    let initialContentCount: number
    let pageIds: string[]
    let selectedPageId: string
    let nodes: SceneNode[]

    beforeAll(async () => {
      graph = await parseFixture(file, { populate: 'none' })
      pageIds = graph.getPages().map((page) => page.id)
      initialContentCount = collectAllNodes(graph).length
      const page = graph.getPages().find((candidate) => candidate.source.id === sourcePageId)
      if (!page) throw new Error(`Missing fixture page ${sourcePageId}`)
      selectedPageId = page.id
      expect(populateFigPage(graph, selectedPageId)).toBe(true)
      nodes = collectAllNodes(graph)
    })

    afterAll(() => {
      if (graph) releaseFigPopulationWorker(graph)
    })

    test('none creates page shells without eagerly expanding content', () => {
      expect(graph).toBeInstanceOf(SceneGraph)
      expect(pageIds.length).toBeGreaterThan(1)
      expect(initialContentCount).toBe(0)
    })

    test('selected-page loading preserves shell identities and is idempotent', () => {
      expect(graph.getPages().map((page) => page.id)).toEqual(pageIds)
      expect(graph.getChildren(selectedPageId).length).toBeGreaterThan(0)
      expect(nodes.length).toBeGreaterThan(0)
      expect(populateFigPage(graph, selectedPageId)).toBe(false)
      expect(collectAllNodes(graph).map((node) => node.id)).toEqual(nodes.map((node) => node.id))
      // Getting started / Welcome are not dependencies of these selected component pages.
      expect(graph.getChildren(pageIds[0])).toHaveLength(0)
    })

    test('materializes instances with actual component definitions', () => {
      const instances = nodes.filter((node) => node.type === 'INSTANCE')
      expect(instances.length).toBeGreaterThan(0)
      for (const instance of instances) {
        expect(instance.componentId).not.toBeNull()
        expect(graph.getNode(instance.componentId ?? '')?.type).toBe('COMPONENT')
      }
    })

    test('populated content uses supported types and valid solid colors', () => {
      expect(nodes.length).toBeGreaterThan(0)
      expect(nodes.filter((node) => !VALID_NODE_TYPES.has(node.type))).toEqual([])
      const solids = nodes.flatMap((node) => node.fills).filter((fill) => fill.type === 'SOLID')
      expect(solids.length).toBeGreaterThan(0)
      for (const fill of solids) {
        for (const channel of [fill.color.r, fill.color.g, fill.color.b, fill.color.a]) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    })
  })
}

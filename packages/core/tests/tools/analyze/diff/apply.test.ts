import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { findByName, PROPERTY_CASES } from '#core-tests/helpers/property-cases'
import { pick } from 'es-toolkit'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { createDefaultNode, SceneGraph } from '@open-pencil/scene-graph'

function tool(name: string) {
  return expectDefined(
    ALL_TOOLS.find((candidate) => candidate.name === name),
    name
  )
}

describe('diff_apply property coverage', () => {
  test.each(PROPERTY_CASES.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    async (_, testCase) => {
      const graph = new SceneGraph()
      const figma = new FigmaAPI(graph)
      const page = expectDefined(graph.getPages()[0], 'page')
      const goal = testCase.build(graph, page.id)
      const plain = testCase.build(graph, page.id)
      const target = findByName(graph, plain.rootId, plain.target)
      // The same tree with the target's properties at their defaults.
      const defaults = createDefaultNode(() => target.id, target.type)
      graph.updateNode(target.id, pick(defaults, testCase.fields))
      const expected = findByName(graph, goal.rootId, goal.target)
      expect(pick(target, testCase.fields)).not.toEqual(pick(expected, testCase.fields))

      const created = await tool('diff_create').execute(figma, {
        from: plain.rootId,
        to: goal.rootId
      })
      const patch = expectDefined((created as { diff?: string | null }).diff, 'patch')
      const applied = await tool('diff_apply').execute(figma, { patch })
      expect(applied).toMatchObject({ failed: 0 })

      expect(pick(findByName(graph, plain.rootId, plain.target), testCase.fields)).toEqual(
        pick(expected, testCase.fields)
      )
      expect(
        await tool('diff_create').execute(figma, { from: plain.rootId, to: goal.rootId })
      ).toMatchObject({ diff: null })
    }
  )
})

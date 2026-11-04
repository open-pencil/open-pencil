import { describe, expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'

import { materializeFigArchive } from '@open-pencil/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/**
 * An override and a variable binding can both state a text node's content, and which one Figma
 * shows is decided by the owner's consumption entry: an entry carrying `variableData` binds the
 * field, a bare entry clears it. The archive was authored in Figma for these four cases and the
 * expected strings are what Figma itself renders for them, so this pins our reading to that.
 */
const FIGMA_RENDERS: Record<string, string> = {
  // The component re-binds the field, so the binding wins over the literal each instance records.
  'same-literal': 'Button-sm',
  'different-literal': 'Button-sm',
  // Its literal override is stale — the field was rebound after the override was recorded.
  'return-to-inherited': 'Button-sm',
  // Its owner's entry is bare, which clears the binding, so the literal shows.
  staged: 'Learn more'
}

function firstText(graph: SceneGraph, instance: SceneNode): string | undefined {
  const stack = [...instance.childIds]
  while (stack.length > 0) {
    const node = graph.getNode(stack.pop() as string)
    if (!node) continue
    if (node.type === 'TEXT') return node.text
    stack.push(...node.childIds)
  }
  return undefined
}

describe('variable binding against an instance override', () => {
  test('resolves each authored case the way Figma renders it', () => {
    const { graph } = materializeFigArchive(
      readFixtureArrayBuffer('variable-override-precedence.fig')
    )
    const instances = [...graph.getAllNodes()].filter((node) => node.type === 'INSTANCE')
    const rendered: Record<string, string | undefined> = {}
    for (const name of Object.keys(FIGMA_RENDERS)) {
      const instance = instances.find((node) => node.name === name)
      expect(instance, `missing instance ${name}`).toBeDefined()
      rendered[name] = instance ? firstText(graph, instance) : undefined
    }

    expect(rendered).toEqual(FIGMA_RENDERS)
  })
})

import { beforeAll, describe, expect, test } from 'bun:test'

import { buildKitGraph } from '#kits/build'
import { SHADCN_KIT } from '#kits/shadcn/kit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { missingBindings, readBehaviour } from '@open-pencil/scene-graph/behaviours'

let graph: SceneGraph

beforeAll(async () => {
  graph = await buildKitGraph(SHADCN_KIT)
})

function set(name: string): SceneNode {
  const found = [...graph.getAllNodes()].find(
    (node) => node.type === 'COMPONENT_SET' && node.name === name
  )
  if (!found) throw new Error(`No set ${name}`)
  return found
}

describe('the shadcn/ui kit', () => {
  test('draws each component as a set of its variants', () => {
    expect(graph.getChildren(set('Button').id)).toHaveLength(72)
    expect(set('Switch').componentPropertyDefinitions.map(({ name }) => name)).toEqual([
      'Checked',
      'State',
      'Thumb'
    ])
  })

  test.each([
    ['Switch', 'switch'],
    ['Checkbox', 'checkbox'],
    ['Toggle', 'toggle'],
    ['Slider', 'slider'],
    ['Progress', 'progress']
  ] as const)('makes %s behave as a %s, with nothing left to bind', (name, kind) => {
    const owner = set(name)
    const behaviour = readBehaviour(owner)
    expect(behaviour?.kind).toBe(kind)
    if (!behaviour) return
    expect(missingBindings(graph, owner, behaviour)).toEqual([])
  })

  test('leaves components without a Radix root as they are', () => {
    expect(readBehaviour(set('Button'))).toBeNull()
  })

  test('imports the light and dark themes as modes', () => {
    const [collection] = graph.variableCollections.values()
    expect(collection.modes.map(({ name }) => name)).toEqual(['Light', 'Dark'])
  })
})

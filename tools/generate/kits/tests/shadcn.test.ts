import { beforeAll, describe, expect, test } from 'bun:test'

import { buildKitGraph } from '#kits/build'
import { SHADCN_KIT } from '#kits/shadcn/kit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { missingBindings, readBehaviour } from '@open-pencil/scene-graph/behaviours'

let graph: SceneGraph

/** The first build installs shadcn/ui with its CLI, which downloads the registry and packages. */
const INSTALL_TIMEOUT = 600_000

beforeAll(async () => {
  graph = await buildKitGraph(SHADCN_KIT)
}, INSTALL_TIMEOUT)

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

  test('puts each component on a page of its own, after a cover', () => {
    const pages = graph.getPages().map(({ name }) => name)
    expect(pages.slice(0, 4)).toEqual(['Cover', 'Button', 'Badge', 'Input'])
    expect(pages).toHaveLength(17)
    const switchPage = graph.getPages().find(({ name }) => name === 'Switch')
    const texts = switchPage
      ? graph
          .flattenTree(switchPage.id)
          .flatMap(({ node }) => (node.type === 'TEXT' ? [node.text] : []))
      : []
    // The page says what its documentation says, and shows shadcn's own examples.
    expect(texts).toContain(
      'A control that allows the user to toggle between checked and not checked.'
    )
    expect(texts).toContain('Airplane Mode')
  })

  test('imports the light and dark themes as modes', () => {
    const [collection] = graph.variableCollections.values()
    expect(collection.modes.map(({ name }) => name)).toEqual(['Light', 'Dark'])
  })
})

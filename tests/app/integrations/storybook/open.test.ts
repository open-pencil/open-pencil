import { expect, mock, test } from 'bun:test'

import { rememberLoadedRevision } from '@/app/document/io/revision'
import {
  openImplementationStory,
  type ImplementationNavigation,
  type ImplementationStore
} from '@/app/integrations/storybook/open'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function harness(revision?: string) {
  const graph = makeSceneGraph()
  const node = graph.createNode('COMPONENT', firstPageId(graph), { name: 'Renamed button' })
  node.source.id = '42:9'
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  const store: ImplementationStore = {
    graph,
    state: { selectedIds: new Set([node.id]) },
    getSourceIdentity: () => ({ path: '/repo/design/library.fig' }),
    getStorageBinding: () => null,
    hasUnsavedChanges: () => false
  }
  const text = JSON.stringify({
    version: 1,
    storybook: { baseUrl: 'https://stories.example.test/' },
    components: [
      {
        key: 'button',
        design: { file: 'design/library.fig', id: '42:9', ...(revision ? { revision } : {}) },
        implementation: { import: 'src/button.ts', export: 'Button' },
        story: { id: 'components-button--default' },
        states: [{ key: 'pressed', designId: '42:10', storyId: 'components-button--pressed' }]
      }
    ]
  })
  const open = mock(async (_url: string, _pinned: boolean) => undefined)
  const navigation: ImplementationNavigation = {
    pick: async () => ({ text, path: '/repo/openpencil.components.json' }),
    isCurrent: () => true,
    matchesDocument: async () => true,
    open
  }
  return { graph, node, store, navigation, open, text }
}

test('opens the mapped implementation after a design rename, leaving the developer file untouched', async () => {
  const h = harness(SHA256_ABC)
  await openImplementationStory(h.store, h.navigation)
  expect(h.open).toHaveBeenCalledWith(
    'https://stories.example.test/?path=%2Fstory%2Fcomponents-button--default',
    true
  )
  expect(h.node.name).toBe('Renamed button')
})

test('selecting an explicitly mapped variant opens its own implementation story', async () => {
  const h = harness()
  h.node.source.id = '42:10'
  await openImplementationStory(h.store, h.navigation)
  expect(h.open).toHaveBeenCalledWith(
    'https://stories.example.test/?path=%2Fstory%2Fcomponents-button--pressed',
    false
  )
})

test('does not match the same relative path in another checkout', async () => {
  const h = harness()
  h.navigation.matchesDocument = async () => false
  await expect(openImplementationStory(h.store, h.navigation)).rejects.toThrow('found 0')
  expect(h.open).not.toHaveBeenCalled()
})

test('rejects stale, dirty and live documents for pinned implementation mappings', async () => {
  for (const kind of ['revision', 'dirty', 'live']) {
    const h = harness(kind === 'revision' ? '0'.repeat(64) : SHA256_ABC)
    if (kind === 'dirty') h.store.hasUnsavedChanges = () => true
    if (kind === 'live') h.store.getStorageBinding = () => ({ provider: 'cloud' })
    await expect(openImplementationStory(h.store, h.navigation)).rejects.toThrow('Design revision')
    expect(h.open).not.toHaveBeenCalled()
  }
})

test('a cancelled picker or changed selection never opens a story', async () => {
  const h = harness()
  h.navigation.pick = async () => null
  await openImplementationStory(h.store, h.navigation)
  h.navigation.pick = async () => {
    h.store.state.selectedIds.clear()
    return { text: h.text }
  }
  await openImplementationStory(h.store, h.navigation)
  expect(h.open).not.toHaveBeenCalled()
})

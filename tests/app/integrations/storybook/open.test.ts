import { expect, mock, test } from 'bun:test'

import { rememberLoadedRevision } from '@/app/document/io/revision'
import { notificationMessages } from '@/app/i18n/notifications'
import {
  openImplementationStory,
  type ImplementationNavigation,
  type ImplementationStore
} from '@/app/integrations/storybook/open'

import { withNotificationLocale } from '#tests/helpers/i18n/notifications'
import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function harness(revision?: string, remember = true) {
  const graph = makeSceneGraph()
  const node = graph.createNode('COMPONENT', firstPageId(graph), { name: 'Renamed button' })
  node.source.id = '42:9'
  if (remember) rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
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

for (const phase of ['picker', 'document match']) {
  test(`cancels when a saved identity becomes another mapped state during ${phase}`, async () => {
    const h = harness()
    if (phase === 'picker') {
      h.navigation.pick = async () => {
        h.node.source.id = '42:10'
        return { text: h.text, path: '/repo/openpencil.components.json' }
      }
    } else {
      h.navigation.matchesDocument = async () => {
        h.node.source.id = '42:10'
        return true
      }
    }
    await openImplementationStory(h.store, h.navigation)
    expect(h.open).not.toHaveBeenCalled()
  })

  test(`cancels when a selected instance targets another main component during ${phase}`, async () => {
    const h = harness()
    const other = h.graph.createNode('COMPONENT', firstPageId(h.graph))
    other.source.id = '42:10'
    const instance = h.graph.createNode('INSTANCE', firstPageId(h.graph), {
      componentId: h.node.id
    })
    h.store.state.selectedIds.clear()
    h.store.state.selectedIds.add(instance.id)
    const retarget = () => h.graph.updateNode(instance.id, { componentId: other.id })
    if (phase === 'picker') {
      h.navigation.pick = async () => {
        retarget()
        return { text: h.text, path: '/repo/openpencil.components.json' }
      }
    } else {
      h.navigation.matchesDocument = async () => {
        retarget()
        return true
      }
    }
    await openImplementationStory(h.store, h.navigation)
    expect(h.open).not.toHaveBeenCalled()
  })
}

test('mapping navigation errors follow the active locale and interpolate the actual candidate count', async () => {
  const english = notificationMessages.get()
  await withNotificationLocale('fr', async () => {
    const h = harness()
    const messages = notificationMessages.get()
    expect(messages.implementationSelectionRequired).not.toBe(
      english.implementationSelectionRequired
    )
    h.store.state.selectedIds.clear()
    await expect(openImplementationStory(h.store, h.navigation)).rejects.toThrow(
      messages.implementationSelectionRequired
    )
    h.store.state.selectedIds.add(h.node.id)
    h.navigation.matchesDocument = async () => false
    await expect(openImplementationStory(h.store, h.navigation)).rejects.toThrow(
      messages.implementationMappingCount({ count: 0 })
    )
    expect(h.open).not.toHaveBeenCalled()

    const unopened = harness(undefined, false)
    await expect(openImplementationStory(unopened.store, unopened.navigation)).rejects.toThrow(
      messages.implementationMappingReopenRequired
    )
    expect(unopened.open).not.toHaveBeenCalled()

    const stale = harness('0'.repeat(64))
    await expect(openImplementationStory(stale.store, stale.navigation)).rejects.toThrow(
      messages.implementationMappingRevisionMismatch
    )
    expect(stale.open).not.toHaveBeenCalled()

    const changing = harness(SHA256_ABC)
    let checks = 0
    changing.store.hasUnsavedChanges = () => ++checks > 1
    await expect(openImplementationStory(changing.store, changing.navigation)).rejects.toThrow(
      messages.implementationDocumentChanged
    )
    expect(changing.open).not.toHaveBeenCalled()
  })
  expect(notificationMessages.get().implementationSelectionRequired).toBe(
    english.implementationSelectionRequired
  )
})

test('invalid mapping files report a localized error while retaining parser diagnostics as the cause', async () => {
  await withNotificationLocale('fr', async () => {
    const h = harness()
    h.navigation.pick = async () => ({ text: '{' })
    try {
      await openImplementationStory(h.store, h.navigation)
      throw new Error('Invalid mappings must not open implementation stories')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw error
      expect(error.message).toBe(notificationMessages.get().implementationMappingInvalid)
      expect(error.cause).toBeInstanceOf(Error)
    }
    expect(h.open).not.toHaveBeenCalled()
  })
})

test('a saved identity changed during mapping lookup cancels without reporting an invalid mapping', async () => {
  await withNotificationLocale('fr', async () => {
    const h = harness()
    h.navigation.matchesDocument = async () => {
      h.node.source.id = '42:99'
      return true
    }
    await expect(openImplementationStory(h.store, h.navigation)).resolves.toBeUndefined()
    expect(h.open).not.toHaveBeenCalled()
  })
})

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openAssets(page: Page) {
  await page.getByTestId('left-panel-assets-tab').click()
}

async function openLibraries(page: Page) {
  await page.getByRole('button', { name: 'Manage libraries' }).click()
}

test('preserves source publication identity across FIG save and reopen', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const componentId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page missing')
    return store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Source button',
      componentKey: 'source-button',
      width: 80,
      height: 32
    }).id
  })

  await openAssets(page)
  await openLibraries(page)
  await page.getByRole('button', { name: 'Publish library' }).click()
  const publish = page.getByRole('dialog').filter({ hasText: 'Publish library' })
  await publish.getByLabel('Library ID').fill('source-lifecycle')
  await publish.getByLabel('Library name').fill('Source lifecycle')
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('asset-libraries-dialog')).toBeHidden()
  const firstRevision = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const value = store?.graph
      .getNode(store.graph.rootId)
      ?.pluginData.find((entry) => entry.key === 'sourceLibraryPublication')?.value
    return value ? (JSON.parse(value) as { revisionId: string }).revisionId : null
  })
  expect(firstRevision).toBeTruthy()

  const saved = await page.evaluate(async () => {
    const writes: Uint8Array[] = []
    window.showSaveFilePicker = async () =>
      ({
        name: 'source.fig',
        getFile: async () => new File([], 'source.fig'),
        createWritable: async () => ({
          write: async (data: Uint8Array) => writes.push(data),
          close: async () => undefined
        })
      }) as FileSystemFileHandle
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    await store.saveFigFileAs()
    return Array.from(writes[0] ?? [])
  })
  expect(saved.length).toBeGreaterThan(0)

  await page.evaluate((bytes) => {
    const file = new File([new Uint8Array(bytes)], 'source.fig')
    window.showOpenFilePicker = async () => [{ getFile: async () => file } as FileSystemFileHandle]
  }, saved)
  await page.keyboard.press('ControlOrMeta+KeyO')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const root = store?.graph.getNode(store.graph.rootId)
        return root?.pluginData.find((entry) => entry.key === 'sourceLibraryPublication')?.value
      })
    )
    .toContain('source-lifecycle')

  await openAssets(page)
  await openLibraries(page)
  await page.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toHaveValue('source-lifecycle')
  await expect(publish.getByLabel('Library ID')).toBeDisabled()
  await expect(publish.getByText('No asset changes')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.evaluate((sourceId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const component = [...store.graph.getAllNodes()].find(
      (node) => node.source.id === sourceId || node.componentKey === 'source-button'
    )
    if (!component) throw new Error('Reopened source component missing')
    store.graph.updateNode(component.id, { width: 144, name: 'Source button updated' })
  }, componentId)
  await openAssets(page)
  await openLibraries(page)
  await page.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Source button updated')).toBeChecked()
  await expect(publish.getByText('Modified')).toBeVisible()
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toBeHidden()

  const secondRevision = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const value = store?.graph
      .getNode(store.graph.rootId)
      ?.pluginData.find((entry) => entry.key === 'sourceLibraryPublication')?.value
    return value ? (JSON.parse(value) as { revisionId: string }).revisionId : null
  })
  expect(secondRevision).toBeTruthy()
  expect(secondRevision).not.toBe(firstRevision)
})

test('publishes, consumes, saves, and reopens a multidimensional library instance offline', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')
    const set = store.graph.createNode('COMPONENT_SET', pageNode.id, {
      name: 'Button',
      componentPropertyDefinitions: [
        {
          id: 'size',
          name: 'Size',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Large']
        },
        {
          id: 'tone',
          name: 'Tone',
          type: 'VARIANT',
          defaultValue: 'Neutral',
          variantOptions: ['Neutral', 'Brand']
        }
      ]
    })
    for (const [index, [size, tone]] of [
      ['Small', 'Neutral'],
      ['Small', 'Brand'],
      ['Large', 'Neutral'],
      ['Large', 'Brand']
    ].entries()) {
      const component = store.graph.createNode('COMPONENT', set.id, {
        name: `Size=${size}, Tone=${tone}`,
        x: (index % 2) * 160,
        y: Math.floor(index / 2) * 80,
        width: size === 'Large' ? 144 : 96,
        height: size === 'Large' ? 48 : 32,
        componentPropertyValues: { Size: size, Tone: tone }
      })
      store.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: `${size} ${tone}`,
        width: 90,
        height: 20
      })
    }
    store.requestRender()
  })

  await openAssets(page)
  await openLibraries(page)
  await page.getByRole('button', { name: 'Publish library' }).click()
  const publish = page.getByRole('dialog').filter({ hasText: 'Publish library' })
  await publish.getByLabel('Library ID').fill('e2e-design-system')
  await publish.getByLabel('Library name').fill('E2E design system')
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('asset-libraries-dialog')).toBeHidden()

  await page.keyboard.press('ControlOrMeta+KeyN')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store ? [...store.graph.getAllNodes()].length : 0
      })
    )
    .toBeGreaterThan(0)
  await openAssets(page)
  await openLibraries(page)
  const libraryRow = page.getByText('E2E design system').locator('..').locator('..')
  await libraryRow.getByRole('button', { name: 'Enable library' }).click()
  await libraryRow.getByRole('button', { name: 'Prefer this library' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('asset-libraries-dialog')).toBeHidden()

  await page.getByRole('button', { name: 'List view' }).click()
  const asset = page.getByTestId('asset-item').filter({ hasText: 'Button' })
  await asset.getByTestId('asset-insert').click()
  await canvas.waitForRender()
  const variants = page.getByRole('region', { name: 'Variants' })
  await variants.getByRole('combobox', { name: 'Size' }).click()
  await page.getByRole('option', { name: 'Large' }).click()
  await variants.getByRole('combobox', { name: 'Tone' }).click()
  await page.getByRole('option', { name: 'Brand' }).click()

  const saved = await page.evaluate(async () => {
    const writes: Uint8Array[] = []
    window.showSaveFilePicker = async () =>
      ({
        name: 'consumer.fig',
        getFile: async () => new File([], 'consumer.fig'),
        createWritable: async () => ({
          write: async (data: Uint8Array) => writes.push(data),
          close: async () => undefined
        })
      }) as FileSystemFileHandle
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    await store.saveFigFileAs()
    return Array.from(writes[0] ?? [])
  })
  expect(saved.length).toBeGreaterThan(0)

  await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], 'consumer.fig')
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const url = String(args[0])
      if (url.includes('library')) throw new Error('offline')
      return originalFetch(...args)
    }
    window.showOpenFilePicker = async () => [{ getFile: async () => file } as FileSystemFileHandle]
  }, saved)
  await page.keyboard.press('ControlOrMeta+KeyO')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return null
        const instance = [...store.graph.getAllNodes()].find((node) => node.type === 'INSTANCE')
        const component = instance?.componentId ? store.graph.getNode(instance.componentId) : null
        const definitions = [...store.graph.getAllNodes()].filter((node) => node.librarySource)
        return instance && component
          ? {
              values: component.componentPropertyValues,
              libraryId: component.librarySource?.identity.libraryId,
              revisionId: component.librarySource?.identity.revisionId,
              readOnly: component.librarySource?.readOnly,
              definitions: definitions.map((node) => ({
                name: node.name,
                libraryId: node.librarySource?.identity.libraryId
              })),
              enabled: store.graph.enabledLibraries.get('e2e-design-system')?.enabled
            }
          : null
      })
    )
    .toMatchObject({
      values: { Size: 'Large', Tone: 'Brand' },
      definitions: expect.arrayContaining([
        expect.objectContaining({ libraryId: 'e2e-design-system' })
      ])
    })

  await expect(page.getByText(/send was called before connect/i)).toHaveCount(0)
})

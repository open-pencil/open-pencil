import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('library manager scopes populated updates and does not mutate on discovery', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  const source = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page missing')
    const component = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Button',
      componentKey: 'button',
      width: 80,
      height: 32,
      cornerRadius: 4,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0.8, b: 0.1, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    store.graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'Old',
      x: 16,
      y: 6,
      width: 48,
      height: 20
    })
    const card = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Card',
      componentKey: 'card',
      x: 180,
      width: 160,
      height: 100
    })
    store.requestRender()
    return { buttonId: component.id, cardId: card.id }
  })

  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  await page.getByRole('button', { name: 'Publish library' }).click()
  const publish = page.getByRole('dialog').filter({ hasText: 'Publish library' })
  await publish.getByLabel('Library ID').fill('manager-e2e')
  await publish.getByLabel('Library name').fill('Manager E2E')
  await expect(publish.getByText('Changes')).toBeVisible()
  await expect(publish.getByLabel('Button')).toBeChecked()
  await expect(publish.getByLabel('Card')).toBeChecked()
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toBeHidden()
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+KeyN')
  await expect.poll(() => page.evaluate(() => !!window.openPencil?.getStore?.())).toBe(true)

  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  const manager = page.getByTestId('asset-libraries-dialog')
  const libraryRow = manager.getByText('Manager E2E').locator('..').locator('..')
  await libraryRow.getByRole('button', { name: 'Enable library' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'List view' }).click()
  await page
    .getByTestId('asset-item')
    .filter({ hasText: 'Button' })
    .getByTestId('asset-insert')
    .click()
  await page
    .getByTestId('asset-item')
    .filter({ hasText: 'Card' })
    .getByTestId('asset-insert')
    .click()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const instances = [...store.graph.getAllNodes()].filter((node) => node.type === 'INSTANCE')
    if (instances.some((instance) => !instance.componentId))
      throw new Error('Inserted instance missing')
    const second = store.graph.addPage('Second')
    for (const instance of instances) {
      if (instance.componentId)
        store.graph.createNode('INSTANCE', second.id, { componentId: instance.componentId })
    }
  })

  await page.getByTestId('tabbar-tab').nth(0).click()
  await page.evaluate(({ buttonId, cardId }) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.graph.updateNode(buttonId, {
      width: 144,
      height: 48,
      name: 'Button updated',
      cornerRadius: 14,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0.25, b: 0.1, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    const label = store.graph.getChildren(buttonId).find((node) => node.type === 'TEXT')
    if (label) store.graph.updateNode(label.id, { text: 'New', x: 48, y: 14 })
    store.graph.updateNode(cardId, { name: 'Card updated', width: 240, height: 140 })
    store.requestRender()
  }, source)
  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  await page.getByRole('button', { name: 'Publish library' }).click()
  await publish.getByLabel('Revision description').fill('Wider button')
  await expect(publish.getByLabel('Library ID')).toBeDisabled()
  await expect(publish.getByLabel('Button updated')).toBeChecked()
  await expect(publish.getByLabel('Card updated')).toBeChecked()
  await expect(publish).toHaveScreenshot('library-publish-changes.png', {
    animations: 'disabled'
  })
  const searchChanges = publish.getByPlaceholder('Search changes')
  await searchChanges.fill('Button')
  await expect(publish.getByLabel('Card updated')).toHaveCount(0)
  await publish.getByLabel('Changes').click()
  await searchChanges.fill('')
  await expect(publish.getByLabel('Button updated')).not.toBeChecked()
  await expect(publish.getByLabel('Card updated')).toBeChecked()
  await publish.getByLabel('Card updated').click()
  await expect(publish.getByRole('button', { name: 'Publish library' })).toBeDisabled()
  await publish.getByLabel('Button updated').click()
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Revision description')).toBeHidden()
  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  await page.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Card updated')).toBeChecked()
  await expect(publish.getByLabel('Button updated')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(publish.getByLabel('Library ID')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(manager).toBeHidden()
  await page.getByTestId('tabbar-tab').nth(1).click()

  await page.getByTestId('left-panel-assets-tab').click()
  await expect(page.getByRole('button', { name: 'Review library updates' })).toBeVisible()
  await page.getByRole('button', { name: 'Review library updates' }).click()
  await expect(manager.getByRole('button', { name: /Updates/ })).toHaveAttribute(
    'data-state',
    'active'
  )
  await expect(manager.getByText('Button updated')).toBeVisible()
  const before = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.getAllNodes()].map((node) => node.id)
  })
  await expect(manager.getByTestId('library-update-instance-count')).toHaveText('Instances: 1')
  expect(
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return [...store.graph.getAllNodes()].map((node) => node.id)
    })
  ).toEqual(before)

  await manager.getByRole('switch', { name: 'Show updates for all pages' }).click()
  await expect(manager.getByTestId('library-update-instance-count')).toHaveText('Instances: 2')
  await page.keyboard.press('Escape')

  const instances = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const ids = [...store.graph.getAllNodes()]
      .filter((node) => {
        if (node.type !== 'INSTANCE' || !node.componentId) return false
        return store.graph.getNode(node.componentId)?.name.includes('Button')
      })
      .map((node) => node.id)
    store.select([ids[0]])
    return ids
  })
  const instanceUpdate = page.getByRole('button', { name: 'Update selected instance' })
  await expect(instanceUpdate).toBeVisible()
  await instanceUpdate.click()
  const updateMenuItem = page.getByTestId('instance-update-selected')
  await expect(updateMenuItem).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(updateMenuItem).toBeHidden()
  const reviewOrigin = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      pageId: store.state.currentPageId,
      selectedIds: [...store.state.selectedIds],
      panX: store.state.panX,
      panY: store.state.panY,
      zoom: store.state.zoom
    }
  })
  await instanceUpdate.click()
  await page.getByTestId('instance-review-update').click()
  const reviewDialog = page.getByTestId('library-update-review')
  await expect(reviewDialog).toBeVisible()
  await expect(reviewDialog.getByRole('heading', { name: 'Current' })).toBeVisible()
  await expect(reviewDialog.getByRole('heading', { name: 'Updated' })).toBeVisible()
  await expect(reviewDialog.getByRole('img', { name: 'Current' })).toBeVisible()
  await expect(reviewDialog.getByRole('img', { name: 'Updated' })).toBeVisible()
  await expect(reviewDialog.getByRole('button', { name: 'Previous instance' })).toBeDisabled()
  await expect(reviewDialog.getByRole('button', { name: 'Next instance' })).toBeDisabled()
  await expect(reviewDialog).toHaveScreenshot('library-update-side-by-side.png', {
    animations: 'disabled'
  })
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const otherPage = store.graph.getPages().find((page) => page.id !== store.state.currentPageId)
    if (otherPage) await store.switchPage(otherPage.id)
    store.clearSelection()
    store.state.panX += 120
    store.state.panY -= 80
    store.state.zoom = 0.5
  })
  await page.keyboard.press('Escape')
  await expect(reviewDialog).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return null
        return {
          pageId: store.state.currentPageId,
          selectedIds: [...store.state.selectedIds],
          panX: store.state.panX,
          panY: store.state.panY,
          zoom: store.state.zoom
        }
      })
    )
    .toEqual(reviewOrigin)
  await instanceUpdate.click()
  await updateMenuItem.click()
  await expect(instanceUpdate).toBeHidden()
  const mixedComponents = await page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return ids.map((id) => store.graph.getNode(id)?.componentId)
  }, instances)
  expect(new Set(mixedComponents).size).toBe(2)

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
  }, instances[1])
  await expect(instanceUpdate).toBeVisible()

  await page.keyboard.press('ControlOrMeta+KeyZ')
  const undoneComponents = await page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return ids.map((id) => store.graph.getNode(id)?.componentId)
  }, instances)
  expect(new Set(undoneComponents).size).toBe(1)

  await page.keyboard.press('ControlOrMeta+Shift+KeyZ')
  const redoneComponents = await page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return ids.map((id) => store.graph.getNode(id)?.componentId)
  }, instances)
  expect(new Set(redoneComponents).size).toBe(2)

  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: /libraries|updates/i }).click()
  await manager.getByRole('button', { name: /Updates/ }).click()
  await manager.getByRole('button', { name: 'Button updated' }).click()
  await expect(reviewDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reviewDialog).toBeHidden()
  await expect(manager.getByText('Card updated')).toHaveCount(0)
})

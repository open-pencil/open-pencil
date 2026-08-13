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
      height: 32
    })
    store.requestRender()
    return component.id
  })

  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  await page.getByRole('button', { name: 'Publish library' }).click()
  const publish = page.getByRole('dialog').filter({ hasText: 'Publish library' })
  await publish.getByLabel('Library ID').fill('manager-e2e')
  await publish.getByLabel('Library name').fill('Manager E2E')
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Library ID')).toBeHidden()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Meta+KeyN')
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

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const instance = [...store.graph.getAllNodes()].find((node) => node.type === 'INSTANCE')
    if (!instance?.componentId) throw new Error('Inserted instance missing')
    const second = store.graph.addPage('Second')
    store.graph.createNode('INSTANCE', second.id, { componentId: instance.componentId })
  })

  await page.getByTestId('tabbar-tab').nth(0).click()
  await page.evaluate((componentId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.graph.updateNode(componentId, { width: 144, name: 'Button updated' })
    store.requestRender()
  }, source)
  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: 'Manage libraries' }).click()
  await page.getByRole('button', { name: 'Publish library' }).click()
  await publish.getByLabel('Revision description').fill('Wider button')
  await publish.getByRole('button', { name: 'Publish library' }).click()
  await expect(publish.getByLabel('Revision description')).toBeHidden()
  await page.keyboard.press('Escape')
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
      .filter((node) => node.type === 'INSTANCE')
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
  await instanceUpdate.click()
  await page.getByTestId('instance-review-update').click()
  const reviewDialog = page.getByTestId('library-update-review')
  await expect(reviewDialog).toBeVisible()
  await expect(reviewDialog.getByRole('heading', { name: 'Current' })).toBeVisible()
  await expect(reviewDialog.getByRole('heading', { name: 'Updated' })).toBeVisible()
  await expect(reviewDialog.getByRole('img', { name: 'Current' })).toBeVisible()
  await expect(reviewDialog.getByRole('img', { name: 'Updated' })).toBeVisible()
  await page.screenshot({ path: '/tmp/openpencil-library-review.png' })
  await page.keyboard.press('Escape')
  await expect(reviewDialog).toBeHidden()
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

  await page.keyboard.press('Meta+KeyZ')
  const undoneComponents = await page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return ids.map((id) => store.graph.getNode(id)?.componentId)
  }, instances)
  expect(new Set(undoneComponents).size).toBe(1)

  await page.keyboard.press('Meta+Shift+KeyZ')
  const redoneComponents = await page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return ids.map((id) => store.graph.getNode(id)?.componentId)
  }, instances)
  expect(new Set(redoneComponents).size).toBe(2)

  await page.getByTestId('left-panel-assets-tab').click()
  await page.getByRole('button', { name: /libraries|updates/i }).click()
  await manager.getByRole('button', { name: /Updates/ }).click()
  await manager.getByRole('switch', { name: 'Show updates for all pages' }).click()
  await expect(manager.getByText('No library updates')).toBeVisible()
})

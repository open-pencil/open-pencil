import { expect, test } from '#tests/helpers/chat/fixture'

const PILOT = 'tests/fixtures/vectorize/pilot_avatar.png'
const PYTHON = 'tests/fixtures/vectorize/python_logo.png'

test('current selection toggles and remains visible in history', async ({
  configuredChat: chat
}) => {
  const nodeId = await chat.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Store not available')
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Pinned hero'
    })
    store.select([node.id])
    return node.id
  })
  const toggle = chat.page.getByRole('button', { name: 'Add current selection as context' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-state', 'on')
  await expect(toggle).toBeEnabled()
  await expect(chat.page.locator('[data-slot="chat-context-chip"] img')).toBeVisible()
  await toggle.click()
  await expect(chat.page.locator('[data-slot="chat-context-chip"]')).toHaveCount(0)
  await toggle.click()
  await chat.submit('Make it larger')

  await expect(chat.userMessage()).not.toContainText('[Referenced nodes')
  await expect(
    chat.userMessage().getByRole('button', { name: /View attachment Pinned hero/ })
  ).toBeVisible()
  await expect
    .poll(() => chat.page.locator('html').getAttribute('data-last-chat-request'))
    .toContain(nodeId)
})

test('image drafts can be attached and removed', async ({ configuredChat: chat }) => {
  const chooser = chat.page.waitForEvent('filechooser')
  await chat.page.getByRole('button', { name: 'Attach images' }).click()
  await (await chooser).setFiles([PILOT, PYTHON])

  await expect(chat.page.getByText('pilot_avatar.png', { exact: true })).toBeVisible()
  await expect(chat.page.getByText('python_logo.png', { exact: true })).toBeVisible()
  await chat.page.getByRole('button', { name: 'Remove image pilot_avatar.png' }).click()
  await expect(chat.page.getByText('pilot_avatar.png', { exact: true })).toBeHidden()
  await chat.page.getByRole('button', { name: 'Remove image python_logo.png' }).click()
})

test('sent images and text appear immediately in history', async ({ configuredChat: chat }) => {
  await chat.input.fill('Use these images for the new layout')
  const chooser = chat.page.waitForEvent('filechooser')
  await chat.page.getByRole('button', { name: 'Attach images' }).click()
  await (await chooser).setFiles([PILOT, PYTHON])
  await chat.sendButton.click()

  await expect(chat.userMessage()).toContainText('Use these images for the new layout')
  await expect(
    chat.userMessage().getByRole('button', { name: 'View attachment pilot_avatar.png' })
  ).toBeVisible()
  await expect(
    chat.userMessage().getByRole('button', { name: 'View attachment python_logo.png' })
  ).toBeVisible()
})

test('node context stays hidden when combined with an image', async ({ configuredChat: chat }) => {
  await chat.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Store not available')
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'Card' })
    store.select([node.id])
  })
  await chat.input.fill('Use this reference')
  await chat.page.getByRole('button', { name: 'Add current selection as context' }).click()
  const chooser = chat.page.waitForEvent('filechooser')
  await chat.page.getByRole('button', { name: 'Attach images' }).click()
  await (await chooser).setFiles(PILOT)
  await chat.sendButton.click()

  await expect(chat.userMessage()).toContainText('Use this reference')
  await expect(chat.userMessage()).not.toContainText('[Referenced nodes')
})

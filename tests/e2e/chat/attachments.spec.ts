import type { Page } from '@playwright/test'

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

type DroppedFile = { name: string; type: string; content: 'svg' | 'png' | 'text' }

/**
 * Drags files onto the chat transcript; `drop: false` stops at the drag, so what it shows over
 * the composer can be checked. Returns whether the page took the drag.
 */
async function dragOntoChat(
  page: Page,
  files: DroppedFile[],
  { drop = true }: { drop?: boolean } = {}
) {
  return page.getByTestId('chat-panel').evaluate(
    async (panel, { files, drop }) => {
      async function png(): Promise<Blob> {
        const canvas = new OffscreenCanvas(8, 8)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas context unavailable')
        context.fillStyle = '#08f'
        context.fillRect(0, 0, 8, 8)
        return canvas.convertToBlob({ type: 'image/png' })
      }
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12" fill="#f00"/></svg>'
      const bodies = { svg: async () => svg, png, text: async () => 'notes' }
      const transfer = new DataTransfer()
      for (const file of files) {
        const body = await bodies[file.content]()
        transfer.items.add(new File([body], file.name, { type: file.type }))
      }
      const bounds = panel.getBoundingClientRect()
      const options = {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + 40,
        dataTransfer: transfer
      }
      panel.dispatchEvent(new DragEvent('dragenter', options))
      const accepted = !panel.dispatchEvent(new DragEvent('dragover', options))
      if (drop) panel.dispatchEvent(new DragEvent('drop', options))
      return accepted
    },
    { files, drop }
  )
}

test('images dropped anywhere on the chat attach, with SVGs drawn as PNGs', async ({
  configuredChat: chat
}) => {
  const files: DroppedFile[] = [
    { name: 'photo.png', type: 'image/png', content: 'png' },
    { name: 'icon.svg', type: 'image/svg+xml', content: 'svg' }
  ]
  expect(await dragOntoChat(chat.page, files, { drop: false })).toBe(true)
  const overlay = chat.page.locator('[data-slot="drop-overlay"]')
  await expect(overlay).toContainText('Drop images to attach')

  await dragOntoChat(chat.page, files)
  await expect(overlay).toBeHidden()
  await expect(chat.page.getByText('photo.png', { exact: true })).toBeVisible()
  await expect(chat.page.getByText('icon.png', { exact: true })).toBeVisible()
})

test('a drag without images is left to the window', async ({ configuredChat: chat }) => {
  // The window still takes it, to open documents, but the chat does not offer to attach it.
  const notes: DroppedFile[] = [{ name: 'notes.txt', type: 'text/plain', content: 'text' }]
  await dragOntoChat(chat.page, notes, { drop: false })
  await expect(chat.page.locator('[data-slot="drop-overlay"]')).toBeHidden()
})

test('a full message shows why more images cannot be dropped', async ({ configuredChat: chat }) => {
  const chooser = chat.page.waitForEvent('filechooser')
  await chat.page.getByRole('button', { name: 'Attach images' }).click()
  await (await chooser).setFiles([PILOT, PYTHON, PILOT, PYTHON])
  await expect(chat.page.getByRole('button', { name: /Remove image/ })).toHaveCount(4)

  const photo: DroppedFile[] = [{ name: 'photo.png', type: 'image/png', content: 'png' }]
  await dragOntoChat(chat.page, photo, { drop: false })
  await expect(chat.page.locator('[data-slot="drop-overlay"]')).toContainText(
    'Up to 4 images per message'
  )
  await dragOntoChat(chat.page, photo)
  await expect(chat.page.locator('[data-slot="drop-overlay"]')).toBeHidden()
  await expect(chat.page.getByRole('button', { name: /Remove image/ })).toHaveCount(4)
  await expect(chat.page.getByText('Up to 4 images per message', { exact: true })).toBeVisible()
})

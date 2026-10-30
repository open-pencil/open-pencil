import { strToU8, zipSync } from 'fflate'

import { expect, test } from '#tests/helpers/chat/fixture'

const SKILL =
  '---\nname: grid\ndescription: Lay out pages on an eight-point grid.\n---\n# Grid\n\nSnap every frame to multiples of 8.'

test('@ inserts a layer as a chip that the reply shows and that selects the layer', async ({
  configuredChat: chat
}) => {
  const { page } = chat
  const heroId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const node = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Hero',
      width: 200,
      height: 120
    })
    store.select([])
    return node.id
  })

  await chat.input.click()
  // An `@` inside a word, as in an address, is not a reference.
  await page.keyboard.type('ann@Her')
  await expect(page.getByRole('option', { name: /Hero/ })).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('Tighten @Her')
  await page.getByRole('option', { name: /Hero/ }).click()
  const draftChip = chat.input.locator('[data-slot="chat-reference"]')
  await expect(draftChip).toHaveText('Hero')
  await page.keyboard.type('please')
  await page.keyboard.press('Enter')

  const sent = chat.userMessage().locator('[data-slot="chat-reference"]')
  await expect(sent).toHaveText('Hero')
  const request = await page.evaluate(() => document.documentElement.dataset.lastChatRequest)
  expect(request).toContain(`(openpencil://node/${encodeURIComponent(heroId)})`)

  // The mock reply repeats the request, so it carries the reference too.
  const replied = chat.assistantMessage().getByRole('button', { name: /Hero/ })
  await replied.click()
  await expect
    .poll(() => page.evaluate(() => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])]))
    .toEqual([heroId])
})

test('/ starts a message with a skill', async ({ configuredChat: chat }) => {
  const { page } = chat
  await page.getByTestId('provider-settings-trigger').click()
  await page.getByRole('tab', { name: 'Skills', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload skill' }).click()
  await (
    await chooser
  ).setFiles({
    name: 'grid.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ 'grid/SKILL.md': strToU8(SKILL) }))
  })
  await expect(page.locator('[data-item="grid"]')).toBeVisible()
  await page.getByTestId('app-settings-done').click()

  await chat.input.click()
  await page.keyboard.type('/')
  await page.getByRole('option', { name: /skill:grid/ }).click()
  await page.keyboard.type('lay out the hero')
  await expect(chat.input).toHaveText('/skill:grid lay out the hero')
})

test('editing a sent message keeps its chips and Escape cancels', async ({
  configuredChat: chat
}) => {
  const { page } = chat
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    store.graph.createNode('FRAME', store.state.currentPageId, { name: 'Hero' })
  })
  await chat.input.click()
  await page.keyboard.type('Widen @Her')
  await page.getByRole('option', { name: /Hero/ }).click()
  await page.keyboard.press('Enter')
  await expect(chat.assistantMessage()).toBeVisible()

  await chat.userMessage().hover()
  await page.getByRole('button', { name: 'Edit message' }).click()
  const editor = page.getByRole('textbox', { name: 'Edit message' })
  await expect(editor.locator('[data-slot="chat-reference"]')).toHaveText('Hero')
  await expect(editor).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(editor).toBeHidden()
})

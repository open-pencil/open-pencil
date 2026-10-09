import type { Page } from '@playwright/test'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { openAppMenu } from '#tests/helpers/menu'
import { propertyField, propertySection } from '#tests/helpers/properties'
import { getNodeById, getPageChildren, getSelectedNode } from '#tests/helpers/store'

/** A small icon set served in place of the Iconify API, so the workflow needs no network. */
const SET = {
  prefix: 'test',
  width: 24,
  height: 24,
  icons: {
    square: { body: '<path fill="currentColor" d="M2 2h20v20H2z"/>' },
    ring: { body: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"/>' }
  }
}

const ctx = useEditorSetupWithClear()
/** Requests per endpoint, and the set each search was limited to. */
const requests = { search: 0, sets: 0, searchPrefixes: [] as (string | null)[] }

test.beforeAll(async () => {
  await ctx.page.route('https://api.iconify.design/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search') {
      requests.search++
      requests.searchPrefixes.push(url.searchParams.get('prefix'))
      await route.fulfill({
        json: {
          icons: ['test:square', 'test:ring'],
          total: 2,
          collections: { test: { name: 'Test Icons', total: 2 } }
        }
      })
    } else if (url.pathname === '/collections') {
      await route.fulfill({
        json: { test: { name: 'Test Icons', total: 2, license: { title: 'MIT' } } }
      })
    } else if (url.pathname === '/collection') {
      await route.fulfill({ json: { uncategorized: ['square', 'ring'] } })
    } else {
      requests.sets++
      await route.fulfill({ json: SET })
    }
  })
})

test.beforeEach(() => {
  requests.search = 0
  requests.sets = 0
  requests.searchPrefixes = []
})

async function pick(page: Page, picker: string, query: string, icon: string) {
  const dialog = page.getByRole('dialog', { name: picker })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox').fill(query)
  await dialog.getByRole('option', { name: icon }).click()
  await expect(dialog).toBeHidden()
}

/** The layer tree row named `name`. */
function layerRow(page: Page, name: string) {
  return page.locator('[data-node-id]').filter({ hasText: name }).first()
}

async function insertSquare(page: Page) {
  await page.getByRole('button', { name: 'Insert icon' }).click()
  await pick(page, 'Insert icon', 'shape', 'square')
  await expect(propertyField(page, 'icon-name')).toContainText('square')
}

test('the toolbar inserts a picked icon, selected, as one undo step', async () => {
  const { page, canvas } = ctx
  await insertSquare(page)

  const icon = await getSelectedNode(page)
  expect(icon).toMatchObject({ type: 'FRAME', name: 'square', width: 24 })
  expect(icon?.childIds).toHaveLength(1)
  // The search previews and the placed icon load the set once between them.
  expect(requests).toMatchObject({ search: 1, sets: 1 })

  await canvas.undo()
  expect(await getPageChildren(page)).toEqual([])
})

test('the Object menu opens the same picker', async () => {
  const { page } = ctx
  const menu = await openAppMenu(page, 'Object')
  await menu.getByRole('menuitem', { name: 'Insert Icon…' }).click()
  await pick(page, 'Insert icon', 'shape', 'ring')

  expect(await getSelectedNode(page)).toMatchObject({ name: 'ring' })
})

test('the Icon section swaps the glyph in place, undoably', async () => {
  const { page, canvas } = ctx
  await insertSquare(page)
  const before = await getSelectedNode(page)

  await propertySection(page, 'Icon').getByRole('button', { name: 'Swap icon' }).click()
  await pick(page, 'Swap icon', 'shape', 'ring')

  await expect(propertyField(page, 'icon-name')).toContainText('ring')
  expect(await getSelectedNode(page)).toMatchObject({
    id: before?.id,
    x: before?.x,
    y: before?.y,
    name: 'ring'
  })

  await canvas.undo()
  await expect(propertyField(page, 'icon-name')).toContainText('square')
})

test('the Icon section recolors the icon', async () => {
  const { page, canvas } = ctx
  await insertSquare(page)
  const pathId = (await getSelectedNode(page))?.childIds[0] ?? ''

  const hex = propertyField(page, 'icon-color').getByTestId('color-hex-input')
  await hex.fill('FF0000')
  await hex.press('Enter')
  // Undo in a focused field undoes its text; the document's undo needs focus elsewhere.
  await hex.blur()

  await expect
    .poll(async () => (await getNodeById(page, pathId))?.fills[0]?.color)
    .toMatchObject({ r: 1, g: 0, b: 0 })

  await canvas.undo()
  await expect
    .poll(async () => (await getNodeById(page, pathId))?.fills[0]?.color)
    .toMatchObject({ r: 0, g: 0, b: 0 })
})

test('a chosen set is browsed without a query, and a query searches only it', async () => {
  const { page } = ctx
  await page.getByRole('button', { name: 'Insert icon' }).click()
  const dialog = page.getByRole('dialog', { name: 'Insert icon' })
  await dialog.getByRole('button', { name: 'Icon set' }).click()
  await page.getByRole('option', { name: /Test Icons/ }).click()

  // Each icon of the set shows once, under the set or ahead of it as recent.
  await expect(dialog.getByRole('option')).toHaveCount(2)
  expect(requests.search).toBe(0)

  await dialog.getByRole('textbox').fill('shape')
  await expect.poll(() => requests.searchPrefixes).toEqual(['test'])
  await expect(dialog.getByRole('option')).toHaveCount(2)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('icons in the file and picked lately come first', async () => {
  const { page, canvas } = ctx
  await insertSquare(page)
  await page.getByRole('button', { name: 'Insert icon' }).click()
  const dialog = page.getByRole('dialog', { name: 'Insert icon' })
  await expect(
    dialog.getByRole('group', { name: 'In this file' }).getByRole('option', { name: 'square' })
  ).toBeVisible()
  // Canvas shortcuts wait for the picker to finish closing.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // With the icon gone from the file, it is still among the recent ones.
  await canvas.clearCanvas()
  expect(await getPageChildren(page)).toEqual([])
  await page.getByRole('button', { name: 'Insert icon' }).click()
  await expect(
    dialog.getByRole('group', { name: 'Recent' }).getByRole('option', { name: 'square' })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('an edited icon says so, asks before a swap discards the edit, and resets or detaches', async () => {
  const { page } = ctx
  await insertSquare(page)
  // Rotate the icon's path, as someone editing its artwork would, then select the icon again.
  const iconRow = layerRow(page, 'square')
  await iconRow.locator('[data-slot="disclosure"]').click()
  await layerRow(page, 'path').click()
  const rotationField = propertyField(page, 'rotation')
  await rotationField.click()
  const rotation = rotationField.getByRole('spinbutton', { name: 'Rotation' })
  await rotation.fill('15')
  await rotation.press('Enter')
  await iconRow.click()
  const section = propertySection(page, 'Icon')
  await expect(propertyField(page, 'icon-modified')).toBeVisible()

  await section.getByRole('button', { name: 'Swap icon' }).click()
  const swap = page.getByRole('dialog', { name: 'Swap icon' })
  await swap.getByRole('textbox').fill('shape')
  await swap.getByRole('option', { name: 'ring' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(propertyField(page, 'icon-name')).toContainText('square')

  await section.getByRole('button', { name: 'Reset to the original icon' }).click()
  await expect(propertyField(page, 'icon-modified')).toBeHidden()
  expect((await getSelectedNode(page))?.childIds).toHaveLength(1)

  await section.getByRole('button', { name: 'Detach icon' }).click()
  await expect(section).toBeHidden()
})

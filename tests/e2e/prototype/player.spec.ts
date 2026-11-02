import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

interface AppIds {
  login: string
  home: string
  profile: string
  button: string
  tab: string
  back: string
}

/** Sign in → Home → Profile: a button, a tab named after a screen, and a back button. */
async function buildApp(page: Page): Promise<AppIds> {
  return page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const screen = (name: string, x: number) =>
      graph.createNode('FRAME', pageId, { name, x, y: 0, width: 390, height: 844, fills: solid(1, 1, 1) })
    const box = (parentId: string, name: string, x: number, y: number, width: number, height: number) =>
      graph.createNode('FRAME', parentId, { name, x, y, width, height, fills: solid(0.3, 0.3, 0.9) })
    const text = (parentId: string, content: string) =>
      graph.createNode('TEXT', parentId, { name: content, text: content, x: 0, y: 0, width: 100, height: 20 })
    const login = screen('Sign in', 0)
    const home = screen('Home', 500)
    const profile = screen('Profile', 1000)
    const button = box(login.id, 'Button', 40, 700, 310, 56)
    text(button.id, 'Continue')
    const bar = box(home.id, 'Tab bar', 0, 780, 390, 64)
    const tab = box(bar.id, 'Tab', 20, 8, 150, 48)
    text(tab.id, 'Profile')
    const back = box(profile.id, 'Back', 16, 48, 48, 40)
    text(back.id, 'Back')
    store.select([login.id])
    return { login: login.id, home: home.id, profile: profile.id, button: button.id, tab: tab.id, back: back.id }
  })
}

async function open(page: Page) {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  return buildApp(page)
}

test('auto-linking connects forward, navigation and back, and the player follows them', async ({
  page
}) => {
  const ids = await open(page)
  await page.getByTestId('prototype-auto').click()
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.lawha?.getStore?.().graph.getNode(id)
        return node?.pluginData.find((e) => e.key === 'prototype.interactions')?.value ?? ''
      }, ids.button)
    )
    .toContain(ids.home)

  await page.getByTestId('prototype-present').click()
  const player = page.getByTestId('prototype-player')
  const name = page.getByTestId('prototype-screen-name')
  await expect(player).toBeVisible()
  await expect(name).toHaveText('Sign in')
  await expect(player).toContainText('Screen 1 of 3')

  await page.locator(`[data-hotspot="${ids.button}"]`).click()
  await expect(name).toHaveText('Home')
  await page.locator(`[data-hotspot="${ids.tab}"]`).click()
  await expect(name).toHaveText('Profile')
  await expect(player).toContainText('Screen 3 of 3')
  await page.locator(`[data-hotspot="${ids.back}"]`).click()
  await expect(name).toHaveText('Home')

  await page.getByTestId('prototype-restart').click()
  await expect(name).toHaveText('Sign in')
  await page.keyboard.press('Escape')
  await expect(player).toHaveCount(0)
})

test('an after-delay interaction moves on by itself', async ({ page }) => {
  const ids = await open(page)
  await page.evaluate(
    ({ login, home }) => {
      const store = window.lawha?.getStore?.()
      if (!store) throw new Error('Lawha store not initialized')
      const value = JSON.stringify([
        {
          trigger: { type: 'after-delay', delay: 400 },
          action: { type: 'navigate', destination: home, transition: { type: 'dissolve', duration: 100 } }
        }
      ])
      store.graph.updateNode(login, {
        pluginData: [{ pluginId: 'lawha', key: 'prototype.interactions', value }]
      })
    },
    { login: ids.login, home: ids.home }
  )
  await page.getByTestId('prototype-present').click()
  const name = page.getByTestId('prototype-screen-name')
  await expect(name).toHaveText('Sign in')
  await expect(name).toHaveText('Home', { timeout: 3000 })
})

test('the interaction editor shows the linked button and saves a new transition', async ({
  page
}) => {
  const ids = await open(page)
  await page.getByTestId('prototype-auto').click()
  await page.evaluate((id) => window.lawha?.getStore?.().select([id]), ids.button)
  await expect(page.getByTestId('prototype-interaction')).toHaveCount(1)
  await page.getByTestId('prototype-transition').click()
  await page.getByRole('option', { name: 'Push' }).click()
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.lawha?.getStore?.().graph.getNode(id)
        return node?.pluginData.find((e) => e.key === 'prototype.interactions')?.value ?? ''
      }, ids.button)
    )
    .toContain('"type":"push"')
})

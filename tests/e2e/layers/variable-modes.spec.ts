import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { layerDriver } from '#tests/helpers/canvas/layers'

const editor = useEditorSetup()
const layers = layerDriver(() => editor.page)

const LAYER_NAME = 'Profile header, wide'

type Row = ReturnType<typeof editor.page.locator>

const badgeEndsBeforeActions = (row: Row) =>
  row.evaluate((element) => {
    const badge = element.querySelector('[data-slot="variable-mode"]')
    const actions = element.querySelector('[data-slot="actions"]')
    if (!badge || !actions) {
      throw new Error('Expected a mode badge and actions')
    }
    return badge.getBoundingClientRect().right <= actions.getBoundingClientRect().left + 0.5
  })

const settled = () =>
  editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )

const setRowWidth = (row: Row, width: string) =>
  row.evaluate((element, rowWidth) => {
    element.style.width = rowWidth
  }, width)

const badgeFormIn = (row: Row) =>
  row
    .locator('[data-slot="variable-mode"]')
    .evaluate((element) =>
      element.querySelector('[data-slot="variable-mode-count"]') ? 'count' : 'full'
    )

test('a layer with modes in several collections keeps its whole name beside one mode badge', async () => {
  const { frameId, singleId, copyId } = await layers.layersWithModes(LAYER_NAME)

  const row = editor.page.locator(`[data-node-id="${frameId}"] [data-slot="row"]`)
  const badge = row.locator('[data-slot="variable-mode"]')
  const count = row.locator('[data-slot="variable-mode-count"]')
  const fullForm = row.locator('[data-slot="variable-mode-full"]')
  await expect(badge).toHaveCount(1)
  const fullList = 'Theme (1): Dark, Theme (2): Light alt, Density: Compact, and Size: Large'
  await expect(badge.locator('.sr-only')).toHaveText(fullList)

  const name = row.getByText(LAYER_NAME, { exact: true })
  const badgeClipped = () => badge.evaluate((element) => element.scrollWidth > element.clientWidth)
  const nameEnd = () =>
    name.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        clipped: element.scrollWidth > element.clientWidth,
        faded: style.maskImage.includes('gradient'),
        ellipsis: style.textOverflow === 'ellipsis'
      }
    })
  const uncut = { clipped: false, faded: false, ellipsis: false }
  const fadedOut = { clipped: true, faded: true, ellipsis: false }
  expect(await nameEnd()).toEqual(uncut)
  expect(await badgeClipped()).toBe(false)
  const layersScroll = editor.page.getByTestId('layers-scroll')
  expect(await layersScroll.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(
    0
  )

  const badgeForm = () => badgeFormIn(row)
  const actionsShown = () =>
    expect(row.locator('[data-slot="actions"]')).toHaveCSS('position', 'static')
  const badgeWidth = () => badge.evaluate((element) => element.getBoundingClientRect().width)

  const idleSlack = await row.evaluate((element) => {
    const label = element.querySelector('[data-slot="label"]')
    const nameElement = element.querySelector('[data-slot="name"]')
    const badgeElement = element.querySelector('[data-slot="variable-mode"]')
    if (!label || !nameElement || !badgeElement) {
      throw new Error('Expected a labelled row')
    }
    const gap = Number.parseFloat(getComputedStyle(label).columnGap)
    const used = nameElement.scrollWidth + gap + badgeElement.getBoundingClientRect().width
    return label.getBoundingClientRect().width - used
  })
  const rowWidth = await row.evaluate((element) => element.getBoundingClientRect().width)
  const slackHoverCannotFit = 8
  await setRowWidth(row, `${rowWidth - idleSlack + slackHoverCannotFit}px`)
  await settled()
  expect(await nameEnd()).toEqual(uncut)
  const idleForm = await badgeForm()
  const idleBadgeWidth = await badgeWidth()
  await row.hover({ position: { x: 4, y: 4 } })
  await actionsShown()
  await expect.poll(nameEnd).toEqual(fadedOut)
  expect(await badgeForm()).toBe(idleForm)
  expect(await badgeWidth()).toBe(idleBadgeWidth)
  expect(await badgeClipped()).toBe(false)
  expect(await badgeEndsBeforeActions(row)).toBe(true)

  await row.hover()
  await badge.hover()
  await expect(editor.page.getByRole('tooltip')).toHaveText(fullList)
  await editor.page.mouse.move(0, 0)

  await setRowWidth(row, '400px')
  await expect(count).toHaveCount(0)
  await expect(fullForm).toBeVisible()
  await expect(row.locator('[data-slot="variable-mode-name"]')).toHaveText('Dark')
  await expect(row.locator('[data-slot="variable-mode-more"]')).toHaveText('+3')
  await expect.poll(nameEnd).toEqual(uncut)

  const listWidth = await layersScroll.evaluate((element) => element.clientWidth)
  const formsSeen = new Set<string>()
  for (let width = 160; width <= 400; width += 8) {
    await setRowWidth(row, `${width}px`)
    await editor.page.mouse.move(0, 0)
    await settled()
    const idle = await badgeForm()
    formsSeen.add(idle)
    await row.hover({ position: { x: 4, y: 4 } })
    await settled()
    await actionsShown()
    expect(await badgeForm(), `row ${width}px wide`).toBe(idle)
    expect(await badgeClipped(), `row ${width}px wide`).toBe(false)
    const hovered = await nameEnd()
    expect(hovered.faded, `row ${width}px wide`).toBe(hovered.clipped)
    expect(hovered.ellipsis, `row ${width}px wide`).toBe(false)
    if (width <= listWidth) {
      expect(await badgeEndsBeforeActions(row), `row ${width}px wide`).toBe(true)
    }
  }
  expect([...formsSeen].sort()).toEqual(['count', 'full'])
  await editor.page.mouse.move(0, 0)

  await setRowWidth(row, '120px')
  await expect(count).toHaveText('4')
  await expect.poll(nameEnd).toEqual(fadedOut)
  expect(await badgeClipped()).toBe(false)

  const singleRow = editor.page.locator(`[data-node-id="${singleId}"] [data-slot="row"]`)
  await expect(singleRow.locator('[data-slot="variable-mode-name"]')).toHaveText('Compact')
  await expect(singleRow.locator('[data-slot="variable-mode-count"]')).toHaveCount(0)
  await setRowWidth(singleRow, '70px')
  await expect(singleRow.locator('[data-slot="variable-mode-count"]')).toHaveText('1')

  await setRowWidth(row, '400px')
  await expect(count).toHaveCount(0)

  await layers.renameCollection(copyId, 'Brand')
  await expect(badge.locator('.sr-only')).toHaveText(
    'Theme: Dark, Brand: Light alt, Density: Compact, and Size: Large'
  )
  editor.canvas.assertNoErrors()
})

test('a deep layer with a short name keeps its mode badge clear of the buttons on hover', async () => {
  const leafId = await layers.deepLayerWithMode()

  const row = editor.page.locator(`[data-node-id="${leafId}"] [data-slot="row"]`)
  const badge = row.locator('[data-slot="variable-mode"]')
  await expect(badge).toHaveCount(1)
  await editor.page.getByTestId('layers-scroll').evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  const icon = await row.locator('[data-slot="icon"]').boundingBox()
  if (!icon) {
    throw new Error('Expected the row icon on screen')
  }
  await editor.page.mouse.move(icon.x + icon.width / 2, icon.y + icon.height / 2)
  await expect(row.locator('[data-slot="actions"]')).toHaveCSS('position', 'static')
  expect(await badge.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false)
  expect(await badgeEndsBeforeActions(row)).toBe(true)
  await editor.page.mouse.move(0, 0)
  editor.canvas.assertNoErrors()
})

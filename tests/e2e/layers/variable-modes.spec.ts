import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

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

test('a layer with modes in several collections keeps its whole name beside one mode badge', async () => {
  const { frameId, singleId, copyId } = await editor.page.evaluate((name) => {
    const store = window.openPencil?.getStore?.()
    if (!store) {
      throw new Error('OpenPencil store not initialized')
    }
    const { graph } = store
    const twoModes = (collectionName: string, first: string, second: string) => {
      const collection = graph.createCollection(collectionName)
      graph.renameMode(collection.id, collection.defaultModeId, first)
      const secondMode = graph.createMode(collection.id, second)
      if (!secondMode) {
        throw new Error('Expected a second mode')
      }
      return { collection, secondMode }
    }
    const theme = twoModes('Theme', 'Light', 'Dark')
    const themeCopy = {
      ...structuredClone(theme.collection),
      id: `${theme.collection.id}-copy`,
      variableIds: [],
      modes: theme.collection.modes.map((mode) => ({ ...mode, name: `${mode.name} alt` }))
    }
    graph.addCollection(themeCopy)
    const density = twoModes('Density', 'Comfortable', 'Compact')
    const size = twoModes('Size', 'Small', 'Large')
    const frame = store.createShape('FRAME', 100, 100, 200, 160)
    graph.updateNode(frame, {
      name,
      variableModes: {
        [theme.collection.id]: theme.secondMode,
        [themeCopy.id]: theme.collection.defaultModeId,
        [density.collection.id]: density.secondMode,
        [size.collection.id]: size.secondMode
      }
    })
    const single = store.createShape('FRAME', 400, 100, 200, 160)
    graph.updateNode(single, {
      name: 'Single',
      variableModes: { [density.collection.id]: density.secondMode }
    })
    return { frameId: frame, singleId: single, copyId: themeCopy.id }
  }, LAYER_NAME)

  const row = editor.page.locator(`[data-node-id="${frameId}"] [data-slot="row"]`)
  const badge = row.locator('[data-slot="variable-mode"]')
  const count = row.locator('[data-slot="variable-mode-count"]')
  const fullForm = row.locator('[data-slot="variable-mode-full"]')
  await expect(badge).toHaveCount(1)
  const fullList = 'Theme (1): Dark, Theme (2): Light alt, Density: Compact, and Size: Large'
  await expect(badge.locator('.sr-only')).toHaveText(fullList)

  const name = row.getByText(LAYER_NAME, { exact: true })
  const nameClipped = () => name.evaluate((element) => element.scrollWidth > element.clientWidth)
  const badgeClipped = () => badge.evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(await nameClipped()).toBe(false)
  expect(await badgeClipped()).toBe(false)
  const layers = editor.page.getByTestId('layers-scroll')
  expect(await layers.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0)

  const settled = () =>
    editor.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
  const badgeForm = () =>
    badge.evaluate((element) =>
      element.querySelector('[data-slot="variable-mode-count"]') ? 'count' : 'full'
    )
  const actionsShown = () =>
    expect(row.locator('[data-slot="actions"]')).toHaveCSS('position', 'static')
  const badgeWidth = () => badge.evaluate((element) => element.getBoundingClientRect().width)

  const setRowWidth = (target: typeof row, width: string) =>
    target.evaluate((element, rowWidth) => {
      element.style.width = rowWidth
    }, width)

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
  expect(await nameClipped()).toBe(false)
  const idleForm = await badgeForm()
  const idleBadgeWidth = await badgeWidth()
  await row.hover({ position: { x: 4, y: 4 } })
  await actionsShown()
  await expect.poll(nameClipped).toBe(true)
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
  expect(await nameClipped()).toBe(false)

  const listWidth = await layers.evaluate((element) => element.clientWidth)
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
    if (width <= listWidth) {
      expect(await badgeEndsBeforeActions(row), `row ${width}px wide`).toBe(true)
    }
  }
  expect([...formsSeen].sort()).toEqual(['count', 'full'])
  await editor.page.mouse.move(0, 0)

  await setRowWidth(row, '120px')
  await expect(count).toHaveText('4')
  expect(await nameClipped()).toBe(true)
  expect(await badgeClipped()).toBe(false)

  const singleRow = editor.page.locator(`[data-node-id="${singleId}"] [data-slot="row"]`)
  await expect(singleRow.locator('[data-slot="variable-mode-name"]')).toHaveText('Compact')
  await expect(singleRow.locator('[data-slot="variable-mode-count"]')).toHaveCount(0)
  await setRowWidth(singleRow, '70px')
  await expect(singleRow.locator('[data-slot="variable-mode-count"]')).toHaveText('1')

  await setRowWidth(row, '400px')
  await expect(count).toHaveCount(0)

  await editor.page.evaluate((id) => {
    window.openPencil?.getStore?.()?.renameCollection(id, 'Brand')
  }, copyId)
  await expect(badge.locator('.sr-only')).toHaveText(
    'Theme: Dark, Brand: Light alt, Density: Compact, and Size: Large'
  )
  editor.canvas.assertNoErrors()
})

test('a deep layer with a short name keeps its mode badge clear of the buttons on hover', async () => {
  const leafId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) {
      throw new Error('OpenPencil store not initialized')
    }
    const { graph } = store
    const collection = graph.createCollection('Spacing')
    const secondMode = graph.createMode(collection.id, 'Loose')
    if (!secondMode) {
      throw new Error('Expected a second mode')
    }
    let parentId = store.state.currentPageId
    for (let depth = 0; depth < 10; depth++) {
      parentId = graph.createNode('FRAME', parentId, { name: 'G', width: 100, height: 100 }).id
    }
    const leaf = graph.createNode('FRAME', parentId, {
      name: 'A',
      width: 20,
      height: 20,
      variableModes: { [collection.id]: secondMode }
    })
    store.requestRender()
    store.select([leaf.id])
    return leaf.id
  })

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

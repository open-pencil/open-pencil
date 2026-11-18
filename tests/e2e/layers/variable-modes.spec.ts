import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

const LAYER_NAME = '1920x1080, md · Card name'

test('a layer with modes in several collections keeps its whole name beside one mode badge', async () => {
  const { frameId, singleId, copyId } = await editor.page.evaluate((name) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const { graph } = store
    const twoModes = (collectionName: string, first: string, second: string) => {
      const collection = graph.createCollection(collectionName)
      graph.renameMode(collection.id, collection.defaultModeId, first)
      const secondMode = graph.createMode(collection.id, second)
      if (!secondMode) throw new Error('Expected a second mode')
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
  await expect(count).toHaveText('4')
  await expect(fullForm).toBeHidden()
  expect(await nameClipped()).toBe(false)
  expect(await badgeClipped()).toBe(false)
  const layers = editor.page.getByTestId('layers-scroll')
  expect(await layers.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0)

  await row.hover()
  await badge.hover()
  await expect(editor.page.getByRole('tooltip')).toHaveText(fullList)
  await editor.page.mouse.move(0, 0)

  const setRowWidth = (target: typeof row, width: string) =>
    target.evaluate((element, rowWidth) => {
      element.style.width = rowWidth
    }, width)

  await setRowWidth(row, '400px')
  await expect(count).toHaveCount(0)
  await expect(fullForm).toBeVisible()
  await expect(row.locator('[data-slot="variable-mode-name"]')).toHaveText('Dark')
  await expect(row.locator('[data-slot="variable-mode-more"]')).toHaveText('+3')
  expect(await nameClipped()).toBe(false)

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
  const formsSeen = new Set<string>()
  for (let width = 160; width <= 400; width += 8) {
    await setRowWidth(row, `${width}px`)
    await editor.page.mouse.move(0, 0)
    await settled()
    const idle = await badgeForm()
    formsSeen.add(idle)
    await row.hover({ position: { x: 4, y: 4 } })
    await settled()
    await expect(row.locator('[data-slot="actions"]')).toHaveCSS('position', 'static')
    expect(await badgeForm(), `row ${width}px wide`).toBe(idle)
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

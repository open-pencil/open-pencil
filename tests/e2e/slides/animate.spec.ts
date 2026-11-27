import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'

const editor = useEditorSetup()
const deck = deckDriver(() => editor.page)

test.afterEach(async () => {
  await editor.page.getByTestId('properties-tab-design').click()
  await deck.close()
})

const steps = () => editor.page.getByTestId('animate-step')

test("a step's settings open under its row and change its animation", async () => {
  const [first] = await deck.open([1])
  await deck.addAnimatedBox(first, 'First')
  await deck.addAnimatedBox(first, 'Second')
  await deck.show(first)
  await editor.page.getByTestId('properties-tab-animate').click()
  await expect(steps()).toHaveCount(2)

  await steps().nth(1).locator('[data-property=animate-step-expand]').click()
  const settings = steps().nth(1).locator('[data-slot=animation-settings]')
  await expect(settings).toBeVisible()
  await settings
    .locator('[data-property=animate-layer-direction]')
    .getByRole('button', { name: 'Up' })
    .click()
  await settings.locator('[data-property=animate-layer-trigger]').click()
  await editor.page.getByRole('option', { name: 'After previous' }).click()
  expect(await deck.animations(first)).toEqual([
    { name: 'First', style: 'SLIDE_FROM_LEFT', trigger: 'ON_CLICK' },
    { name: 'Second', style: 'SLIDE_FROM_BOTTOM', trigger: 'AFTER_PREVIOUS' }
  ])
  // The row says it plays after the step before it.
  await expect(steps().nth(1).getByRole('img', { name: 'After previous' })).toBeVisible()

  await steps().nth(0).getByTestId('animate-remove-animation').click()
  expect((await deck.animations(first)).map((step) => step.name)).toEqual(['Second'])
})

test('dragging a step reorders the build', async () => {
  const [first] = await deck.open([1])
  for (const name of ['One', 'Two', 'Three']) await deck.addAnimatedBox(first, name)
  await deck.show(first)
  await editor.page.getByTestId('properties-tab-animate').click()
  await expect(steps()).toHaveCount(3)

  const from = await steps().nth(2).boundingBox()
  const to = await steps().nth(0).boundingBox()
  if (!from || !to) throw new Error('Expected the step rows to be shown')
  await editor.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await editor.page.mouse.down()
  await editor.page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 8 })
  await editor.page.mouse.up()
  await expect
    .poll(async () => (await deck.animations(first)).map((step) => step.name))
    .toEqual(['Three', 'One', 'Two'])
})

test('Play runs the build on the canvas and turns into Stop while it plays', async () => {
  const [first] = await deck.open([1])
  await deck.addAnimatedBox(first, 'One')
  await deck.show(first)
  await editor.page.getByTestId('properties-tab-animate').click()
  await editor.page.getByTestId('animate-play').click()
  await expect(editor.page.getByTestId('animate-stop')).toBeVisible()
  await editor.page.getByTestId('animate-stop').click()
  await expect(editor.page.getByTestId('animate-play')).toBeVisible()
  expect(
    await editor.page.evaluate(() => window.openPencil?.getStore?.().state.buildPreview ?? null)
  ).toBeNull()
})

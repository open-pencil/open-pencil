import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

const picker = () => page.getByTestId('shader-fill-picker')

/** Opens a new rectangle's fill as a shader and gives it `preset` through the picker's JSON. */
async function shaderWith(preset: unknown) {
  await page.keyboard.press('Escape')
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()
  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('fill-picker-tab-shader').click()
  await picker().getByTestId('shader-preset-toggle').click()
  await picker().locator('textarea').fill(JSON.stringify(preset))
  await picker().getByTestId('shader-preset-apply').click()
  await picker().getByRole('button', { name: 'Expand effect settings' }).first().click()
}

/** The shader's preset as the picker's JSON shows it. */
async function presetJSON(): Promise<unknown> {
  await picker().getByTestId('shader-preset-toggle').click()
  const text = await picker().locator('textarea').inputValue()
  await picker().getByTestId('shader-preset-toggle').click()
  return JSON.parse(text)
}

test("a gradient's color stops are edited as a gradient fill's", async () => {
  await shaderWith({
    components: [
      {
        type: 'MeshGradient',
        props: {
          stops: [
            { color: '#0f0f13', position: 0 },
            { color: '#7c3aed', position: 1 }
          ]
        }
      }
    ]
  })
  const stops = picker().locator('[data-property=shader-stops]')
  await expect(stops.getByTestId('fill-picker-gradient-bar')).toBeVisible()
  // The first stop's position, typed as the panel's number fields take it.
  await stops.getByRole('spinbutton').first().click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('30')
  await page.keyboard.press('Enter')
  await expect.poll(presetJSON).toMatchObject({
    components: [
      {
        type: 'MeshGradient',
        props: {
          stops: [
            { color: '#0f0f13', position: 0.3 },
            { color: '#7c3aed', position: 1 }
          ]
        }
      }
    ]
  })
})

test('an effect drawn from its own colors takes stops that start from them', async () => {
  await shaderWith({
    components: [{ type: 'LinearGradient', props: { colorA: '#ff0000', colorB: '#0000ff' } }]
  })
  await picker().getByTestId('shader-stops-add').click()
  await expect.poll(presetJSON).toMatchObject({
    components: [
      {
        type: 'LinearGradient',
        props: {
          stops: [
            { color: '#ff0000', position: 0 },
            { color: '#0000ff', position: 1 }
          ]
        }
      }
    ]
  })
  // Removing them goes back to the effect's own colors.
  await picker().getByTestId('shader-stops-remove').click()
  await expect.poll(async () => JSON.stringify(await presetJSON())).not.toContain('"stops"')
})

test('dragging a stop moves the stop, not the effect it belongs to', async () => {
  await shaderWith({
    components: [
      {
        type: 'MeshGradient',
        props: {
          stops: [
            { color: '#0f0f13', position: 0 },
            { color: '#7c3aed', position: 0.5 },
            { color: '#fde68a', position: 1 }
          ]
        }
      },
      { type: 'FilmGrain' }
    ]
  })
  // The list shows the top effect first, so the mesh gradient is the second row.
  await picker().getByRole('button', { name: 'Collapse effect settings' }).click()
  await picker()
    .locator('[data-shader-effect=MeshGradient]')
    .getByRole('button', { name: 'Expand effect settings' })
    .click()
  const handle = picker().getByRole('slider', { name: 'Gradient stop 2' })
  const bar = picker().getByTestId('fill-picker-gradient-bar')
  const [from, track] = await Promise.all([handle.boundingBox(), bar.boundingBox()])
  if (!from || !track) throw new Error('Expected the gradient bar and its stop')
  const y = from.y + from.height / 2
  await page.mouse.move(from.x + from.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.2, y, { steps: 10 })
  await page.mouse.up()
  const preset = await presetJSON()
  expect(preset).toMatchObject({ components: [{ type: 'MeshGradient' }, { type: 'FilmGrain' }] })
  const [mesh] = (preset as { components: { props: { stops: { position: number }[] } }[] })
    .components
  expect(mesh.props.stops[1].position).toBeCloseTo(0.2, 1)
})

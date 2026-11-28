import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { fillDriver } from '#tests/helpers/canvas/fill-driver'

// A shader's colour is edited in a picker opened from the fill picker; a drag there is one undo
// step, as any other drag in a picker is.

const editor = useEditorSetupWithClear()
const fill = fillDriver(() => editor.page)

async function expandSettings() {
  await editor.page
    .locator('[data-picker-content]')
    .getByRole('button', { name: 'Expand effect settings' })
    .click()
}

async function reopen() {
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await expandSettings()
}

test('a drag in a shader colour’s picker is one undo step', async () => {
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await editor.page.getByTestId('fill-picker-tab-shader').click()
  await expandSettings()
  await editor.canvas.clearHistory()

  // The first colour setting of the shader's effect, read from its hex as the panel shows it.
  const setting = editor.page
    .locator('[data-picker-content] [data-property^="shader-"]')
    .filter({ has: editor.page.getByTestId('color-hex-input') })
    .first()
  const hex = () => setting.getByTestId('color-hex-input').inputValue()
  const before = await hex()

  await setting.getByRole('button', { name: 'Edit color' }).click()
  const area = editor.page.locator('[data-picker-content] .cursor-crosshair').last()
  const box = await area.boundingBox()
  if (!box) throw new Error('Missing colour area')
  await editor.page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 8 })
  await editor.page.mouse.up()
  await expect.poll(hex).not.toBe(before)
  const dragged = await hex()

  // Escape closes the colour's picker, then the fill picker, keeping the colour.
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.locator('[data-picker-content]')).toHaveCount(0)
  await reopen()
  await expect.poll(hex).toBe(dragged)
  await editor.page.keyboard.press('Escape')

  await editor.canvas.undo()
  await reopen()
  await expect.poll(hex).toBe(before)
  editor.canvas.assertNoErrors()
})

test('leaving a shader for Image or Solid stops drawing it', async () => {
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  const page = editor.page
  const tab = (name: string) => page.getByTestId(`fill-picker-tab-${name}`)
  const paint = () => fill.selectedPaint()
  await page.getByTestId('fill-picker-swatch').first().click()

  await tab('shader').click()
  await expect(page.getByTestId('shader-fill-picker')).toBeVisible()
  await tab('image').click()
  await expect(page.getByTestId('fill-picker-image-well')).toBeVisible()
  await expect(page.getByTestId('shader-fill-picker')).toHaveCount(0)
  await expect.poll(async () => (await paint())?.imageHash).toBeUndefined()

  await tab('shader').click()
  await tab('solid').click()
  await expect.poll(async () => (await paint())?.type).toBe('SOLID')
  await tab('image').click()
  await expect(page.getByTestId('fill-picker-image-well')).toBeVisible()
  await expect(page.getByTestId('shader-fill-picker')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})

// A shader's colour stops, edited as a gradient fill's are.

const picker = () => editor.page.getByTestId('shader-fill-picker')

/** Opens a new rectangle's fill as a shader and gives it `preset` through the picker's JSON. */
async function shaderWith(preset: unknown) {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await editor.page.getByTestId('fill-picker-tab-shader').click()
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
  await editor.page.keyboard.press('ControlOrMeta+a')
  await editor.page.keyboard.type('30')
  await editor.page.keyboard.press('Enter')
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
  await editor.page.mouse.move(from.x + from.width / 2, y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(track.x + track.width * 0.2, y, { steps: 10 })
  await editor.page.mouse.up()
  const preset = await presetJSON()
  expect(preset).toMatchObject({ components: [{ type: 'MeshGradient' }, { type: 'FilmGrain' }] })
  const [mesh] = (preset as { components: { props: { stops: { position: number }[] } }[] })
    .components
  expect(mesh.props.stops[1].position).toBeCloseTo(0.2, 1)
})

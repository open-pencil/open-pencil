import { boxOf, buildScene, selectLayer } from '../app.ts'
import { callout, panelClip, PANEL_RADIUS, picture, type Shot } from './shared.ts'

const CARD = `<Frame name="Card" w={300} h="hug" flex="col" gap={8} p={20} bg="#FFFFFF" rounded={16}>
  <Text name="Title" size={20} weight={700} color="#18181B">Weekend in Lisbon</Text>
  <Text name="Body" size={14} color="#52525B" w="fill">Three days of tiles, trams, and pastries.</Text>
</Frame>`

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  typography: {
    // Tall enough for the whole Typography section.
    window: { width: 1280, height: 1200 },
    async take(page) {
      await buildScene(page, CARD)
      await selectLayer(page, ['Card', 'Body'])
      await page.mouse.move(700, 120)
      const panel = page.getByTestId('properties-panel')
      const formatting = await boxOf(panel.getByRole('button', { name: /^Strikethrough/ }))
      const clip = await panelClip(page, 'Typography', formatting)
      const callouts = [
        await callout(clip, 1, 'left', panel.getByRole('button', { name: 'Font family' })),
        await callout(clip, 2, 'left', panel.getByRole('combobox', { name: 'Font weight' })),
        // The field around the number, past its icon.
        await callout(
          clip,
          3,
          'left',
          panel.getByRole('spinbutton', { name: 'Line height' }).locator('xpath=..')
        ),
        // The first is the layer's own alignment, under Position.
        await callout(clip, 4, 'left', panel.getByRole('button', { name: 'Align left' }).nth(1)),
        await callout(clip, 5, 'left', panel.getByRole('button', { name: /^Bold/ }))
      ]
      return picture(page, clip, PANEL_RADIUS, { callouts })
    }
  }
}

import { boxOf, buildScene, layerBox, settle, showPlain } from '../app.ts'
import { picture, type Shot } from './shared.ts'

/** A signup card with faint, small text and a small button: issues the checks find. */
const SIGNUP = `<Frame name="Signup" w={300} h="hug" flex="col" gap={10} p={20} bg="#FFFFFF" rounded={16}>
  <Text name="Title" size={20} weight={700} color="#18181B">Join the waitlist</Text>
  <Text name="Note" size={10} color="#C4C4CC">We'll write once a month.</Text>
  <Frame name="Button" flex="row" px={12} py={4} rounded={7} bg="#2563EB">
    <Text name="Label" size={12} weight={600} color="#FFFFFF">Join</Text>
  </Frame>
</Frame>`

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  lint: {
    // Short, so the card sits beside the panel's list.
    window: { width: 1280, height: 600 },
    async take(page) {
      await buildScene(page, SIGNUP)
      await page.getByTestId('menubar-view').click()
      await page.getByRole('menuitemcheckbox', { name: 'Design issues' }).click()
      await page.getByRole('tab', { name: 'Lint' }).click()
      await showPlain(page)
      const card = await layerBox(page, ['Signup'])
      const tabs = await boxOf(page.getByRole('tab', { name: 'Design' }))
      const last = await boxOf(page.getByText('Off-scale spacing', { exact: true }))
      const size = page.viewportSize()
      if (!size) throw new Error('No window')
      const left = card.x - 40
      const top = tabs.y - 8
      await settle(page)
      return picture(
        page,
        { x: left, y: top, width: size.width - left, height: last.y + last.height + 24 - top },
        0
      )
    }
  }
}

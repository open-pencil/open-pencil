import { boxOf, buildScene, settle, within } from '../app.ts'
import { inside } from '../compose.ts'
import { playlist } from '../scenes.ts'
import { picture, type Shot } from './shared.ts'

const PAGES = ['Screens', 'Components', 'Ideas']

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  panel: {
    async take(page) {
      await buildScene(page, playlist())
      await page.evaluate((names) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('No store')
        const first = store.graph.getPages()[0]
        store.graph.updateNode(first.id, { name: names[0] })
        for (const name of names.slice(1))
          store.graph.createNode('CANVAS', store.graph.rootId, { name })
        const card = store.graph.getChildren(store.state.currentPageId)[0]
        const song = store.graph.getChildren(card.id)[1]
        const title = store.graph.getChildren(store.graph.getChildren(song.id)[1].id)[0]
        // Selecting the title opens the frames around it in the list.
        store.select([title.id])
        store.select([song.id])
      }, PAGES)
      await settle(page)
      // Shrink the pages list to its pages.
      const handle = page.getByTestId('layers-panel').getByRole('separator').first()
      const handleBox = await boxOf(handle)
      const lastPage = await boxOf(page.getByTestId('pages-item').last())
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x + handleBox.width / 2, lastPage.y + lastPage.height + 12, {
        steps: 8
      })
      await page.mouse.up()
      const row = page.getByTestId('layers-item').filter({ hasText: 'Low Tide' }).first()
      await row.hover()
      await settle(page)
      const panel = await boxOf(page.getByTestId('layers-panel'))
      const top = (await boxOf(page.getByTestId('pages-header'))).y - 4
      const last = await boxOf(page.getByTestId('layers-item').last())
      const clip = {
        x: panel.x,
        y: top,
        width: panel.width - 1,
        height: last.y + last.height + 8 - top
      }
      const song = await boxOf(
        page.getByTestId('layers-item').filter({ hasText: 'Paper Lanterns' }).first()
      )
      const text = await boxOf(
        page.getByTestId('layers-item').filter({ hasText: 'Artist' }).first()
      )
      const callouts = [
        {
          number: 1,
          side: 'right' as const,
          at: inside(clip, within(await boxOf(page.getByTestId('pages-add')), 1, 0.5))
        },
        {
          number: 2,
          side: 'left' as const,
          at: inside(clip, { x: song.x + 26, y: song.y + song.height / 2 })
        },
        {
          number: 3,
          side: 'left' as const,
          at: inside(clip, { x: text.x + 74, y: text.y + text.height / 2 })
        },
        {
          number: 4,
          side: 'right' as const,
          at: inside(clip, within(await boxOf(row.getByRole('button', { name: 'Hide' })), 1, 0.5))
        }
      ]
      return picture(page, clip, 10, { callouts })
    }
  }
}

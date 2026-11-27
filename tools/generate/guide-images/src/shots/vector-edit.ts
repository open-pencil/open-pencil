import { buildScene, layerBox, settle } from '../app.ts'
import { SCENE_RADIUS } from '../scenes.ts'
import { drawPath } from './pen-tool.ts'
import { PAIR_ZOOM, picture, type Shot } from './shared.ts'

/** Small enough for the four results to fit beside the panels. */
const ZOOM = 1.1

const OPERATIONS = [
  { name: 'Union', operation: 'UNION' },
  { name: 'Subtract', operation: 'SUBTRACT' },
  { name: 'Intersect', operation: 'INTERSECT' },
  { name: 'Exclude', operation: 'EXCLUDE' }
] as const

const cell = ({ name }: { name: string }) => `
  <Frame name="${name}" flex="col" gap={10} items="center" w="hug" h="hug">
    <Frame name="Shapes" w={100} h={90}>
      <Rectangle name="Square" x={0} y={0} w={64} h={64} rounded={6} bg="#8B5CF6" />
      <Ellipse name="Circle" x={36} y={26} w={64} h={64} bg="#8B5CF6" />
    </Frame>
    <Text name="Label" size={13} weight={500} color="#3F3F46">${name}</Text>
  </Frame>`

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  points: {
    async take(page) {
      const { board, end } = await drawPath(page)
      await page.mouse.click(end.x, end.y)
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await settle(page)
      // The top point, where the curve was dragged out.
      await page.mouse.click(board.x + 120 * PAIR_ZOOM * 1.4, board.y + 40 * PAIR_ZOOM * 1.4)
      await page.mouse.move(5, 5)
      await settle(page)
      return picture(page, board, SCENE_RADIUS * PAIR_ZOOM * 1.4)
    }
  },
  combine: {
    async take(page) {
      await buildScene(
        page,
        `<Frame name="Board" flex="row" gap={32} p={28} w="hug" h="hug" bg="#FFFFFF" rounded={${SCENE_RADIUS}}>${OPERATIONS.map(cell).join('')}</Frame>`,
        ZOOM
      )
      await page.evaluate((operations) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('No store')
        const board = store.graph.getChildren(store.state.currentPageId)[0]
        for (const [index, { operation }] of operations.entries()) {
          const shapes = store.graph.getChildren(store.graph.getChildren(board.id)[index].id)[0]
          store.select(store.graph.getChildren(shapes.id).map((shape) => shape.id))
          store.booleanOperationSelected(operation)
        }
        store.clearSelection()
      }, OPERATIONS)
      await page.mouse.move(700, 120)
      await settle(page)
      return picture(page, await layerBox(page, ['Board']), SCENE_RADIUS * ZOOM)
    }
  }
}

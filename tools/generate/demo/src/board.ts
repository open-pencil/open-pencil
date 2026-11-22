import { createDocumentGraph } from '@open-pencil/core'
import { renderJSX } from '@open-pencil/core/design-jsx'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'

import { BOARD_SECTION } from './board-names'
import { withMeasuredText, withMeasuringRenderer } from './build'

export { BOARD_NAME } from './board-names'

/**
 * A planning board as a team would sketch one: what several people asked for, in clusters of
 * stickies by colour, and the flow that ships one of them, in FigJam's shapes joined by connectors,
 * with a decision and a loop back. Written as design JSX, as an agent writes a board, so it goes
 * through the same sticky, shape, and connector rendering.
 */
const BOARD = `
<Section name="${BOARD_SECTION}" w={1440} h={680} bg="#F4F7FB">
  <Text name="Asked" x={56} y={48} size={32} weight={700} color="#1E1E1E">What people asked for</Text>
  <Sticky name="Comments" x={56} y={120} color="yellow" author="Ada" textSize="medium">Keep Figma comments when I import</Sticky>
  <Sticky name="Offline" x={312} y={120} color="yellow" author="Lin" textSize="medium">Work offline on the train</Sticky>
  <Sticky name="Phone" x={56} y={376} color="pink" author="Sam" textSize="medium">Review designs on my phone</Sticky>
  <Sticky name="Slides" x={312} y={376} color="pink" author="Kai" textSize="medium">Turn frames into slides</Sticky>
  <Text name="Plan" x={680} y={48} size={32} weight={700} color="#1E1E1E">How we ship it</Text>
  <Shape name="Pick" x={680} y={180} kind="ellipse" w={192} h={112} bg="#FFE299" textSize="medium">Pick one</Shape>
  <Shape name="Spec" x={952} y={180} kind="rounded_rectangle" w={192} h={112} bg="#A8DAFF" textSize="medium">Write the spec</Shape>
  <Shape name="Ready" x={1208} y={156} kind="diamond" w={192} h={160} bg="#D3BDFF" textSize="medium">Ready?</Shape>
  <Shape name="Build" x={1208} y={464} kind="rounded_rectangle" w={192} h={112} bg="#B3EFBD" textSize="medium">Build it</Shape>
  <Shape name="Ship" x={952} y={464} kind="parallelogram_right" w={192} h={112} bg="#B3F4EF" textSize="medium">Ship</Shape>
  <Shape name="Users" x={680} y={456} kind="eng_database" w={192} h={128} bg="#E6E6E6" textSize="medium">Users</Shape>
  <Connector from="Offline" to="Pick" fromSide="right" toSide="left" line="curved" />
  <Connector from="Slides" to="Pick" fromSide="right" toSide="left" line="curved" />
  <Connector from="Pick" to="Spec" fromSide="right" toSide="left" line="straight" />
  <Connector from="Spec" to="Ready" fromSide="right" toSide="left" line="straight" />
  <Connector from="Ready" to="Spec" fromSide="top" toSide="top">No</Connector>
  <Connector from="Ready" to="Build" fromSide="bottom" toSide="top">Yes</Connector>
  <Connector from="Build" to="Ship" fromSide="left" toSide="right" line="straight" />
  <Connector from="Ship" to="Users" fromSide="left" toSide="right" line="straight" />
</Section>
`

/** The board as `.jam` bytes, as the gallery publishes it and the docs landing opens it. */
export async function buildDemoBoard(): Promise<Uint8Array> {
  return withMeasuringRenderer((renderer) =>
    withMeasuredText(renderer, async () => {
      // A board as the app makes one, on FigJam's light page.
      const graph = createDocumentGraph('board', 'light')
      const [page] = graph.getPages()
      graph.updateNode(page.id, { name: 'Board' })
      await renderJSX(graph, BOARD, { parentId: page.id })
      await prepareGraphFonts(graph, [page.id])
      computeAllLayouts(graph, page.id)
      return exportFigFile(graph, { ck: renderer.ck, renderer })
    })
  )
}

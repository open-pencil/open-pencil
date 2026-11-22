import { createDocumentGraph } from '@open-pencil/core'
import { renderJSX } from '@open-pencil/core/design-jsx'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'

import { BOARD_SECTION } from './board-names'
import { withMeasuredText, withMeasuringRenderer } from './build'

export { BOARD_NAME } from './board-names'

/**
 * A planning board as a team would sketch one: stickies for what came up, a flow of FigJam shapes
 * joined by connectors, and a decision with both of its answers. Written as design JSX, as an
 * agent writes a board, so it goes through the same sticky, shape, and connector rendering.
 */
const BOARD = `
<Section name="${BOARD_SECTION}" w={1280} h={700} bg="#FFFFFF">
  <Sticky name="Idea" x={56} y={72} color="yellow" author="Ada" textSize="large">Import Figma comments</Sticky>
  <Sticky name="Question" x={56} y={368} color="violet" author="Lin" textSize="large">Keep reply authors?</Sticky>
  <Shape name="Spec" x={384} y={176} kind="rounded_rectangle" w={200} h={120} bg="#C2E5FF" textSize="large">Spec</Shape>
  <Shape name="Review" x={648} y={136} kind="diamond" w={288} h={200} bg="#FFE8A3" textSize="large">Ready?</Shape>
  <Shape name="Ship" x={1016} y={176} kind="rounded_rectangle" w={200} h={120} bg="#CDF4D3" textSize="large">Ship</Shape>
  <Shape name="Fix" x={692} y={488} kind="rounded_rectangle" w={200} h={120} bg="#FFC7C2" textSize="large">Fix</Shape>
  <Sticky name="Risk" x={996} y={408} color="red" author="Sam" textSize="large">Old files lack IDs</Sticky>
  <Connector from="Idea" to="Spec" fromSide="right" toSide="left" line="curved" />
  <Connector from="Question" to="Spec" fromSide="right" toSide="left" line="curved" />
  <Connector from="Spec" to="Review" fromSide="right" toSide="left" />
  <Connector from="Review" to="Ship" fromSide="right" toSide="left">Yes</Connector>
  <Connector from="Review" to="Fix" fromSide="bottom" toSide="top">No</Connector>
  <Connector from="Fix" to="Spec" fromSide="left" toSide="bottom" />
  <Connector from="Risk" to="Ship" fromSide="top" toSide="bottom" line="straight" dashPattern={[10, 8]} endCap="none" />
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

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { setPageBackgrounds } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts, installTextMeasurer } from '@open-pencil/core/layout'
import { fontManager, prepareGraphFonts } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { createTipComponent } from './document/callout'
import { arrangeChapters, type ChapterContext } from './document/chapters/chapter'
import { createCodeChapter } from './document/chapters/code'
import { createControlsChapter } from './document/chapters/controls'
import { createHelloChapter } from './document/chapters/hello'
import { createLintChapter } from './document/chapters/lint'
import { createModesChapter } from './document/chapters/modes'
import { createShadersChapter } from './document/chapters/shaders'
import { createSlotsChapter } from './document/chapters/slots'
import { createYoursChapter } from './document/chapters/yours'
import { createTheme, PAGE_BACKGROUND } from './document/theme'
import { drawShaderStills } from './shaders/stills'

const INTER_STYLES = ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']

/** The one page the tour is on. */
export const PAGE_NAME = 'Tour'

/** A renderer on a 1×1 surface, for measuring text while laying the document out. */
export async function measuringRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('CanvasKit could not create a surface')
  const renderer = new SkiaRenderer(ck, surface)
  await renderer.loadFonts()
  return { ck, renderer }
}

/** Runs `build` with Inter loaded and text measured by `renderer`, as demo layout needs. */
export async function withMeasuredText<T>(
  renderer: SkiaRenderer,
  build: () => Promise<T>
): Promise<T> {
  const uninstall = installTextMeasurer((node, maxWidth) =>
    renderer.measureTextNode(node, maxWidth)
  )
  try {
    await Promise.all(INTER_STYLES.map((style) => fontManager.loadFont('Inter', style)))
    return await build()
  } finally {
    uninstall()
  }
}

/**
 * Builds the tour into a fresh graph, laid out with `renderer`'s text metrics: one page whose
 * chapters stack top to bottom as sections.
 */
export function buildDemoGraph(renderer: SkiaRenderer): Promise<SceneGraph> {
  return withMeasuredText(renderer, async () => {
    const graph = new SceneGraph()
    const theme = createTheme()
    const [page] = graph.getPages()
    graph.updateNode(page.id, { name: PAGE_NAME })
    setPageBackgrounds(graph, page, [
      { type: 'SOLID', color: parseColor(PAGE_BACKGROUND), opacity: 1, visible: true }
    ])

    // The tip every chapter uses; the last chapter takes it in under its own content.
    const tip = await createTipComponent(graph, theme, page.id)
    const context: ChapterContext = {
      graph,
      theme,
      pageId: page.id,
      tipId: tip.id,
      whereSlotId: tip.whereSlotId
    }

    // Main components first, so the chapters before them can place instances.
    const parts = await createControlsChapter(context)
    const player = await createSlotsChapter(context, parts)
    await createHelloChapter(context, player)
    await createModesChapter(context, player)
    await createShadersChapter(context)
    await createCodeChapter(context, player)
    await createLintChapter(context)
    await createYoursChapter(context)
    arrangeChapters(
      graph,
      graph.getChildren(page.id).filter((node) => node.type === 'SECTION')
    )

    await prepareGraphFonts(graph, [page.id])
    computeAllLayouts(graph, page.id)
    return graph
  })
}

/** The demo document as `.fig` bytes, as `/demo` opens it. */
export async function buildDemoDocument(): Promise<Uint8Array> {
  const { ck, renderer } = await measuringRenderer()
  const graph = await buildDemoGraph(renderer)
  await drawShaderStills(graph)
  return exportFigFile(graph, { ck, renderer })
}

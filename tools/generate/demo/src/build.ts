import { SkiaRenderer } from '@open-pencil/core/canvas'
import { exportFigFile, initCanvasKit } from '@open-pencil/core/io'
import { computeAllLayouts, installTextMeasurer } from '@open-pencil/core/layout'
import { fontManager, prepareGraphFonts } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createAnnouncementSection } from './document/announcement/section'
import { createControlsSection } from './document/controls/section'
import { createPaintSection } from './document/paint/section'
import { createComponentsSection } from './document/sections/components'
import { createDemoVariables } from './document/sections/variables'
import { createTypographySection } from './document/typography/section'

const PAGE_ORIGIN = 60
const PAGE_GAP = 64
const INTER_STYLES = ['Regular', 'Medium', 'SemiBold', 'Bold']

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

/** Builds every page of the demo into a fresh graph, laid out with `renderer`'s text metrics. */
function buildDemoGraph(renderer: SkiaRenderer): Promise<SceneGraph> {
  return withMeasuredText(renderer, async () => {
    const graph = new SceneGraph()
    const [first] = graph.getPages()
    graph.updateNode(first.id, { name: '01 · Components & variables' })
    const typography = graph.addPage('02 · Typography')
    const paint = graph.addPage('03 · Paint & effects')
    const controls = graph.addPage('04 · Controls')

    const announcement = await createAnnouncementSection(graph, first.id)
    graph.updateNode(announcement.rootId, { x: PAGE_ORIGIN, y: PAGE_ORIGIN })
    computeAllLayouts(graph, first.id)
    await createComponentsSection(graph, first.id, {
      x: PAGE_ORIGIN,
      y: PAGE_ORIGIN + (graph.getNode(announcement.rootId)?.height ?? 0) + PAGE_GAP
    })
    createDemoVariables(graph)
    await createTypographySection(graph, typography.id)
    await createPaintSection(graph, paint.id)
    await createControlsSection(graph, controls.id)

    const pages = graph.getPages()
    await prepareGraphFonts(
      graph,
      pages.map((page) => page.id)
    )
    for (const page of pages) computeAllLayouts(graph, page.id)
    return graph
  })
}

/** The demo document as `.fig` bytes, as `/demo` opens it. */
export async function buildDemoDocument(): Promise<Uint8Array> {
  const { ck, renderer } = await measuringRenderer()
  return exportFigFile(await buildDemoGraph(renderer), ck, renderer)
}

import type { SceneGraph } from '@open-pencil/scene-graph'

export const PDF_MODES = ['single', 'frames', 'pages'] as const
export type PDFMode = (typeof PDF_MODES)[number]

/** Most pages one PDF may hold. */
export const MAX_PDF_PAGES = 200

/** One PDF page: these nodes of this design page, sized to their bounds. */
export interface PDFPageSpec {
  pageId: string
  nodeIds: string[]
  /** Name of the frame or design page the PDF page comes from. */
  label?: string
}

export interface PDFPlanInput {
  mode: PDFMode
  /** `single`: the nodes on the one PDF page. `frames`: one PDF page for each. */
  ids?: readonly string[]
  /** `pages`: the design pages to export, in order. */
  pageIds?: readonly string[]
  currentPageId: string
}

export class PDFPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PDFPlanError'
  }
}

function pageIdOfNode(graph: SceneGraph, nodeId: string): string | null {
  return graph.closest(nodeId, (node) => node.type === 'CANVAS')?.id ?? null
}

function visibleChildren(graph: SceneGraph, pageId: string): string[] {
  const page = graph.getNode(pageId)
  if (!page) return []
  return page.childIds.filter((id) => graph.getNode(id)?.visible !== false)
}

/**
 * Decides which PDF pages an export makes. Pure over the scene graph, so it needs neither jsPDF
 * nor a DOM. Throws PDFPlanError when the request names something missing or exports nothing.
 */
export function planPDFPages(graph: SceneGraph, input: PDFPlanInput): PDFPageSpec[] {
  const specs: PDFPageSpec[] = []

  if (input.mode === 'single') {
    const ids = input.ids?.length ? [...input.ids] : visibleChildren(graph, input.currentPageId)
    specs.push({ pageId: input.currentPageId, nodeIds: ids })
  } else if (input.mode === 'frames') {
    const ids = input.ids?.length ? [...input.ids] : visibleChildren(graph, input.currentPageId)
    for (const id of ids) {
      const node = graph.getNode(id)
      if (!node) throw new PDFPlanError(`Node "${id}" not found`)
      specs.push({
        pageId: pageIdOfNode(graph, id) ?? input.currentPageId,
        nodeIds: [id],
        label: node.name
      })
    }
  } else {
    const designPages = graph.getPages()
    const selected = input.pageIds?.length
      ? input.pageIds.map((id) => {
          const page = designPages.find((candidate) => candidate.id === id)
          if (!page) throw new PDFPlanError(`Page "${id}" not found`)
          return page
        })
      : designPages
    for (const page of selected) {
      const ids = visibleChildren(graph, page.id)
      if (ids.length > 0) specs.push({ pageId: page.id, nodeIds: ids, label: page.name })
    }
  }

  if (specs.every((spec) => spec.nodeIds.length === 0)) {
    throw new PDFPlanError('No visible nodes to export')
  }
  if (specs.length > MAX_PDF_PAGES) {
    throw new PDFPlanError(
      `${specs.length} PDF pages requested, the limit is ${MAX_PDF_PAGES}. Export fewer frames or pages.`
    )
  }
  return specs
}

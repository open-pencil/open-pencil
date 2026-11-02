/**
 * How every chapter of the tour is laid out: a section on the one page, holding a numbered
 * heading, the chapter's subject below it, and the Tip card to the subject's right. One subject
 * and one tip per chapter; nothing else. Chapters stack top to bottom, so scrolling reads the
 * tour in order and zooming out shows it whole.
 */
import { computeAllLayouts } from '@lawha/core/layout'
import { Frame, Section, Text } from '@lawha/design-jsx'
import type { TreeNode } from '@lawha/design-jsx'
import type { SceneGraph, SceneNode } from '@lawha/scene-graph'

import { tipInstance, type Tip } from '../callout'
import { renderTree } from '../icons'
import { fillSlot } from '../slot-content'
import type { Theme } from '../theme'
import { sectionName, type TourChapter } from './names'

/** Where the first chapter sits on the page. */
export const PAGE_ORIGIN = 0
/** The air inside a chapter's section. */
export const CHAPTER_PADDING = 96
/** The gap between chapters along the strip. */
export const CHAPTER_GAP = 240
const HEADING_GAP = 72
const TIP_GAP = 64
const HEADING_WIDTH = 720

export interface ChapterContext {
  graph: SceneGraph
  theme: Theme
  pageId: string
  /** The Tip main component every chapter's callout is an instance of. */
  tipId: string
  /** Its Where slot, which each callout fills with the piece of the app to click. */
  whereSlotId: string
}

export interface Heading {
  title: string
  subtitle: string
}

export interface Chapter {
  /** The chapter's section, sized to its content. */
  section: SceneNode
  /** The chapter's subject, for chapters that add to it. */
  subject: SceneNode
}

/** Render `tree` under `parentId` at (`x`, `y`) and return the layer, with its size laid out. */
export async function place(
  { graph }: ChapterContext,
  tree: TreeNode,
  parentId: string,
  x: number,
  y: number
): Promise<SceneNode> {
  const { id } = await renderTree(graph, tree, { parentId, x, y })
  const node = graph.getNode(id)
  if (!node) throw new Error(`"${tree.props.name ?? tree.type}" did not render`)
  return node
}

function heading({ vars }: Theme, index: number, { title, subtitle }: Heading): TreeNode {
  return Frame({
    name: 'Heading',
    flex: 'col',
    w: HEADING_WIDTH,
    h: 'hug',
    gap: 20,
    children: [
      Text({
        name: 'Number',
        font: 'Inter',
        size: 88,
        weight: 800,
        letterSpacing: -4,
        color: vars.numeral,
        children: String(index).padStart(2, '0')
      }),
      Text({
        name: 'Title',
        font: 'Inter',
        size: 48,
        weight: 700,
        letterSpacing: -1,
        color: vars.text,
        children: title
      }),
      Text({
        name: 'Subtitle',
        font: 'Inter',
        size: 18,
        lineHeight: 28,
        w: 'fill',
        color: vars.muted,
        children: subtitle
      })
    ]
  })
}

/**
 * Lay a chapter out in a section of its own: heading, then `subject` under it, then `tip` to
 * the subject's right, top aligned. The section and the subject take their names from
 * `chapter`, which hosts outside the tour find them by. `fill` adds to the subject once it
 * exists, before the tip is placed beside it, for content that needs the subject's layers, such
 * as instances of a component in it. The section is left at the page origin; `arrangeChapters`
 * places it.
 */
export async function layoutChapter(
  context: ChapterContext,
  options: {
    chapter: TourChapter
    heading: Heading
    subject: TreeNode
    tip: Tip
    fill?: (subject: SceneNode) => Promise<void>
  }
): Promise<Chapter> {
  const { graph, pageId } = context
  const { chapter } = options
  const section = await place(
    context,
    Section({
      name: sectionName(chapter),
      w: 100,
      h: 100,
      bg: context.theme.vars.section
    }),
    pageId,
    PAGE_ORIGIN,
    PAGE_ORIGIN
  )
  const pad = CHAPTER_PADDING
  const head = await place(
    context,
    heading(context.theme, chapter.index, options.heading),
    section.id,
    pad,
    pad
  )
  const top = pad + head.height + HEADING_GAP
  const placed = await place(context, options.subject, section.id, pad, top)
  graph.updateNode(placed.id, { name: chapter.subject })
  let subject = graph.getNode(placed.id) ?? placed
  if (options.fill) {
    await options.fill(subject)
    computeAllLayouts(graph, pageId)
    subject = graph.getNode(subject.id) ?? subject
  }
  const tip = await place(
    context,
    tipInstance(context.tipId, options.tip),
    section.id,
    pad + subject.width + TIP_GAP,
    top
  )
  if (options.tip.where) {
    await fillSlot(graph, tip.id, context.whereSlotId, options.tip.where)
    computeAllLayouts(graph, pageId)
  }
  fitSection(context, section.id)
  return { section: graph.getNode(section.id) ?? section, subject }
}

/** Size a section around everything in it, with the chapter's padding past the furthest edges. */
export function fitSection({ graph }: ChapterContext, sectionId: string): void {
  const children = graph.getChildren(sectionId)
  graph.updateNode(sectionId, {
    width: Math.max(...children.map((child) => child.x + child.width)) + CHAPTER_PADDING,
    height: Math.max(...children.map((child) => child.y + child.height)) + CHAPTER_PADDING
  })
}

/**
 * Place the chapters' sections top to bottom in reading order, `CHAPTER_GAP` apart, and order
 * them the same way in the layer list, which reads the first child first.
 */
export function arrangeChapters(graph: SceneGraph, sections: readonly SceneNode[]): void {
  const ordered = [...sections].sort((a, b) => a.name.localeCompare(b.name))
  let y = PAGE_ORIGIN
  for (const [index, section] of ordered.entries()) {
    graph.updateNode(section.id, { x: PAGE_ORIGIN, y })
    y += (graph.getNode(section.id)?.height ?? section.height) + CHAPTER_GAP
    if (section.parentId) graph.insertChildAt(section.id, section.parentId, index)
  }
}

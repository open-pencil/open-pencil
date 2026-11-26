import type { SceneNode } from '@open-pencil/scene-graph'
import {
  createSlide,
  createSlideGrid,
  createSlideRow,
  slideGrid,
  slideNumbers,
  slideSettings,
  type SlidePlacement
} from '@open-pencil/scene-graph/slides'

import { restoreSubtree, snapshotSubtree } from '#core/editor/history/subtree'
import type { EditorContext } from '#core/editor/types'

import { createSlideSizeActions } from './size'

/** A section of the deck and its slides, in order. */
interface DeckSection {
  id: string
  slides: string[]
}

/**
 * Commands on a deck's slides. Each is one undo step that puts the deck's sections and slides back
 * in their order; a section never stays empty, as in Figma.
 */
export function createSlideActions(ctx: EditorContext, zoomToFit: () => void) {
  function grid(): SceneNode | undefined {
    return slideGrid(ctx.graph, ctx.state.currentPageId)
  }

  function sections(): DeckSection[] {
    const holder = grid()
    if (!holder) return []
    return ctx.graph
      .getChildren(holder.id)
      .filter((row) => row.type === 'SLIDE_ROW')
      .map((row) => ({
        id: row.id,
        slides: ctx.graph
          .getChildren(row.id)
          .filter((node) => node.type === 'SLIDE')
          .map((slide) => slide.id)
      }))
  }

  function slideOrder(): string[] {
    return sections().flatMap((section) => section.slides)
  }

  function isSlide(id: string): boolean {
    return ctx.graph.getNode(id)?.type === 'SLIDE'
  }

  /** The named slides in the deck's order, whichever order they were picked in. */
  function inOrder(ids: Iterable<string>): string[] {
    const named = new Set(ids)
    return slideOrder().filter((id) => named.has(id))
  }

  /** Names slides by their numbers, as Figma does, on the page that holds `gridId`. */
  function renumber(gridId: string | undefined = grid()?.id): void {
    const pageId = gridId ? ctx.graph.getNode(gridId)?.parentId : undefined
    if (!gridId || !pageId) return
    for (const [id, number] of slideNumbers(ctx.graph, pageId)) {
      const name = number === null ? '-' : String(number)
      if (ctx.graph.getNode(id)?.name !== name) ctx.graph.updateNode(id, { name })
    }
    ctx.runLayoutForNode(gridId)
    ctx.requestRender()
  }

  /** Puts `id` in `parentId` right after `anchor`, or first when there is none. */
  function placeAfter(id: string, parentId: string, anchor: string | undefined): void {
    const others = (ctx.graph.getNode(parentId)?.childIds ?? []).filter((child) => child !== id)
    ctx.graph.insertChildAt(id, parentId, anchor ? others.indexOf(anchor) + 1 : 0)
  }

  /**
   * Puts what an edit `touched` where `target` has it, bringing back what is missing and dropping
   * what `from` has beyond it. Each touched section or slide goes after the nearest one before it
   * in `target` that is still in place; nothing else moves, so slides a collaborator added or moved
   * meanwhile stay where they are.
   */
  function arrange(
    gridId: string,
    from: readonly DeckSection[],
    target: readonly DeckSection[],
    kept: Map<string, Map<string, SceneNode>>,
    touched: ReadonlySet<string>
  ): void {
    const bring = (id: string, parentId: string) => {
      const subtree = kept.get(id)
      const root = subtree?.get(id)
      if (!ctx.graph.getNode(id) && subtree && root) {
        restoreSubtree(ctx.graph, root, parentId, subtree)
      }
    }
    const holds = (parentId: string, id: string) => ctx.graph.getNode(id)?.parentId === parentId
    const keep = new Set(target.flatMap(({ id, slides }) => [id, ...slides]))
    for (const [index, section] of target.entries()) {
      if (touched.has(section.id) || !holds(gridId, section.id)) {
        bring(section.id, gridId)
        const before = target.slice(0, index).findLast(({ id }) => holds(gridId, id))
        placeAfter(section.id, gridId, before?.id)
      }
      for (const [column, id] of section.slides.entries()) {
        if (!touched.has(id) && holds(section.id, id)) continue
        bring(id, section.id)
        placeAfter(
          id,
          section.id,
          section.slides.slice(0, column).findLast((slide) => holds(section.id, slide))
        )
      }
    }
    const drop = (id: string, subtree: Map<string, SceneNode>) => {
      kept.set(id, subtree)
      ctx.graph.deleteNode(id)
    }
    for (const id of from.flatMap(({ slides }) => slides)) {
      if (!keep.has(id) && ctx.graph.getNode(id)) drop(id, snapshotSubtree(ctx.graph, id))
    }
    for (const { id } of from) {
      const row = ctx.graph.getNode(id)
      if (row && !keep.has(id) && row.childIds.length === 0)
        drop(id, snapshotSubtree(ctx.graph, id))
    }
    // Undo may replay an edit made on another page: its own deck is renumbered.
    renumber(gridId)
  }

  /** Runs a change of the deck's order as one undo step, selecting `select`'s slides after it. */
  function editDeck(
    label: string,
    gridId: string,
    change: () => { target: DeckSection[]; select: readonly string[]; touched: readonly string[] },
    prior: DeckSection[] = sections()
  ): void {
    const selectionBefore = new Set(ctx.state.selectedIds)
    const focusBefore = ctx.state.focusedSlideId
    const kept = new Map<string, Map<string, SceneNode>>()
    const { target, select, touched: slides } = change()
    const after = target.filter((section) => section.slides.length > 0)
    // Undo and redo come back to the view the edit was made in: Slide view, even after the edit
    // emptied the stage, or Grid view.
    const staged = focusBefore !== null
    // Undone or redone from another page, the deck changes there; what is shown stays put.
    const deckPage = ctx.graph.getNode(gridId)?.parentId
    const show = (ids: Iterable<string>, focus: string | null) => {
      if (ctx.state.currentPageId !== deckPage) return
      ctx.setSelectedIds(new Set(ids))
      ctx.state.enteredContainerId = null
      if (staged) setFocus(focus)
      else if (ctx.state.focusedSlideId !== null) setFocus(null)
    }
    const changed = target.filter((section) => !prior.some(({ id }) => id === section.id))
    // The slides the edit adds, removes, or moves, and the sections it adds or empties.
    const touched = new Set([
      ...slides,
      ...changed.map(({ id }) => id),
      ...prior.filter(({ id }) => !after.some((section) => section.id === id)).map(({ id }) => id)
    ])
    const apply = () => {
      arrange(gridId, [...prior, ...changed], after, kept, touched)
      show(select, select.at(0) ?? null)
    }
    apply()
    ctx.undo.push({
      label,
      forward: apply,
      inverse: () => {
        arrange(gridId, after, prior, kept, touched)
        show(selectionBefore, focusBefore)
      }
    })
  }

  function setFocus(id: string | null): void {
    ctx.state.focusedSlideId = id
    ctx.state.hoveredNodeId = null
    // A slide fills the stage, and leaving it shows the whole deck.
    zoomToFit()
  }

  /** The slide new ones follow: the last selected one, the one on the stage, or the deck's last. */
  function anchorSlide(): string | undefined {
    const focused = ctx.state.focusedSlideId
    return (
      inOrder(ctx.state.selectedIds).at(-1) ??
      (focused && isSlide(focused) ? focused : undefined) ??
      slideOrder().at(-1)
    )
  }

  function placed(
    target: DeckSection[],
    ids: readonly string[],
    placement: SlidePlacement,
    newSection: () => string
  ): DeckSection[] {
    const moving = new Set(ids)
    const rest = target.map(({ id, slides }) => ({
      id,
      slides: slides.filter((slide) => !moving.has(slide))
    }))
    if (placement.type === 'section') {
      const at = rest.findIndex(({ id }) => id === placement.before)
      rest.splice(at === -1 ? rest.length : at, 0, { id: newSection(), slides: [...ids] })
      return rest
    }
    const into = rest.find(({ slides }) => slides.includes(placement.slideId))
    if (!into) return target
    const at = into.slides.indexOf(placement.slideId) + (placement.side === 'after' ? 1 : 0)
    into.slides = [...into.slides.slice(0, at), ...ids, ...into.slides.slice(at)]
    return rest
  }

  /** Adds an empty slide after `afterId`, or after the slide being worked on, and shows it. */
  function addSlide(afterId: string | undefined = anchorSlide()): string | null {
    const prior = sections()
    const holder = grid() ?? createSlideGrid(ctx.graph, ctx.state.currentPageId)
    let added: string | null = null
    editDeck(
      'New slide',
      holder.id,
      () => {
        const row = prior.find(({ slides }) => afterId !== undefined && slides.includes(afterId))
        const after = afterId === undefined ? undefined : ctx.graph.getNode(afterId)
        const rowId = row?.id ?? createSlideRow(ctx.graph, holder.id).id
        const slide = createSlide(ctx.graph, rowId)
        if (after) {
          ctx.graph.updateNode(slide.id, { width: after.width, height: after.height })
        }
        added = slide.id
        const target = row ? prior : [...prior, { id: rowId, slides: [] }]
        return {
          target: target.map((section) =>
            section.id === rowId
              ? { ...section, slides: withAfter(section.slides, afterId, [slide.id]) }
              : section
          ),
          select: [slide.id],
          touched: [slide.id]
        }
      },
      prior
    )
    return added
  }

  /** Copies slides, each right after the last of them, and shows the copies. */
  function duplicateSlides(ids: Iterable<string>): void {
    const sources = inOrder(ids)
    const last = sources.at(-1)
    const gridId = grid()?.id
    if (!last || !gridId) return
    const prior = sections()
    editDeck(
      'Duplicate slides',
      gridId,
      () => {
        const row = prior.find(({ slides }) => slides.includes(last))
        const copies = row ? sources.flatMap((id) => ctx.graph.cloneTree(id, row.id)?.id ?? []) : []
        return {
          target: prior.map((section) =>
            section === row
              ? { ...section, slides: withAfter(section.slides, last, copies) }
              : section
          ),
          select: copies,
          touched: copies
        }
      },
      prior
    )
  }

  /** Deletes slides and shows the one after them, or the one before at the end, as Figma does. */
  function deleteSlides(ids: Iterable<string>): void {
    const doomed = new Set(inOrder(ids).filter((id) => !ctx.graph.getNode(id)?.locked))
    const gridId = grid()?.id
    if (doomed.size === 0 || !gridId) return
    const order = slideOrder()
    const firstAt = order.findIndex((id) => doomed.has(id))
    const next =
      order.slice(firstAt).find((id) => !doomed.has(id)) ??
      order.slice(0, firstAt).findLast((id) => !doomed.has(id))
    editDeck('Delete slides', gridId, () => ({
      target: sections().map(({ id, slides }) => ({
        id,
        slides: slides.filter((slide) => !doomed.has(slide))
      })),
      select: next ? [next] : [],
      touched: [...doomed]
    }))
  }

  /** Moves slides, kept in the deck's order, to a place in it. */
  function moveSlides(ids: Iterable<string>, placement: SlidePlacement): void {
    const moving = inOrder(ids)
    const gridId = grid()?.id
    if (moving.length === 0 || !gridId) return
    // Dropped on one of themselves, they stay.
    if (placement.type === 'beside' && moving.includes(placement.slideId)) return
    const prior = sections()
    editDeck(
      'Move slides',
      gridId,
      () => ({
        target: placed(prior, moving, placement, () => createSlideRow(ctx.graph, gridId).id),
        select: moving,
        touched: moving
      }),
      prior
    )
  }

  /** Has presenting pass slides by, or show them again. */
  function setSlidesSkipped(ids: Iterable<string>, skipped: boolean): void {
    const before = inOrder(ids).flatMap((id) => {
      const node = ctx.graph.getNode(id)
      const settings = node && slideSettings(node)
      return settings && settings.skipped !== skipped ? [{ id, settings }] : []
    })
    if (before.length === 0) return
    const gridId = grid()?.id
    const write = (value: (settings: (typeof before)[number]['settings']) => boolean) => {
      for (const { id, settings } of before) {
        const current = ctx.graph.getNode(id)
        const kept = current ? slideSettings(current) : null
        if (kept) ctx.graph.updateNode(id, { slide: { ...kept, skipped: value(settings) } })
      }
      renumber(gridId)
    }
    const forward = () => write(() => skipped)
    forward()
    ctx.undo.push({
      label: skipped ? 'Skip slides' : 'Show slides',
      forward,
      inverse: () => write((settings) => settings.skipped)
    })
  }

  /** Sets a slide's speaker notes, plain text with a paragraph per line, as one undo step. */
  function setSlideNotes(id: string, notes: string): void {
    const node = ctx.graph.getNode(id)
    const before = node ? slideSettings(node)?.notes : undefined
    if (before === undefined || before === notes) return
    const write = (value: string) => {
      const current = ctx.graph.getNode(id)
      const kept = current ? slideSettings(current) : null
      if (kept) ctx.graph.updateNode(id, { slide: { ...kept, notes: value } })
    }
    write(notes)
    ctx.undo.push({
      label: 'Edit notes',
      forward: () => write(notes),
      inverse: () => write(before)
    })
  }

  /** Puts one slide on the stage, alone, or with null shows the whole deck. */
  function focusSlide(id: string | null): void {
    if (id !== null && !isSlide(id)) return
    if (id === ctx.state.focusedSlideId) return
    setFocus(id)
    ctx.state.enteredContainerId = null
    if (id === null) return
    // Layers of another slide leave the selection with the stage, so no key acts on what is hidden.
    const shown = [...ctx.state.selectedIds].filter(
      (selected) => isSlide(selected) || ctx.graph.isDescendant(selected, id)
    )
    if (shown.length !== ctx.state.selectedIds.size) ctx.setSelectedIds(new Set(shown))
  }

  /** Shows the slide `step` away from the one on the stage, stopping at the ends. */
  function focusAdjacentSlide(step: 1 | -1): void {
    const order = slideOrder()
    const index = ctx.state.focusedSlideId ? order.indexOf(ctx.state.focusedSlideId) : -1
    const next = index === -1 ? undefined : order.at(index + step)
    if (!next || index + step < 0) return
    focusSlide(next)
    ctx.setSelectedIds(new Set([next]))
  }

  // A slide another person removed leaves the stage to the one now nearest.
  ctx.onEditorEvent('node:deleted', (id) => {
    if (id !== ctx.state.focusedSlideId) return
    queueMicrotask(() => {
      if (ctx.state.focusedSlideId === id && !ctx.graph.getNode(id)) {
        setFocus(slideOrder().at(0) ?? null)
      }
    })
  })
  // A deck opens on its first slide, as Figma's does; a page without slides shows whole.
  const openOnFirstSlide = () => {
    ctx.state.focusedSlideId = slideOrder().at(0) ?? null
    if (ctx.state.focusedSlideId === null) return
    const { width, height } = ctx.getViewportSize()
    // A canvas not yet measured is fitted by its host once it has a size.
    if (width > 0 && height > 0) zoomToFit()
  }
  ctx.onEditorEvent('graph:replaced', openOnFirstSlide)
  ctx.onEditorEvent('page:changed', openOnFirstSlide)
  // A new editor's canvas has no size of its own yet, so its host fits the slide once shown.
  ctx.state.focusedSlideId = slideOrder().at(0) ?? null

  return {
    ...createSlideSizeActions(ctx, zoomToFit),
    addSlide,
    duplicateSlides,
    deleteSlides,
    moveSlides,
    setSlidesSkipped,
    setSlideNotes,
    focusSlide,
    focusAdjacentSlide
  }
}

function withAfter(
  slides: readonly string[],
  afterId: string | undefined,
  added: readonly string[]
): string[] {
  const index = afterId === undefined ? -1 : slides.indexOf(afterId)
  return index === -1
    ? [...slides, ...added]
    : [...slides.slice(0, index + 1), ...added, ...slides.slice(index + 1)]
}

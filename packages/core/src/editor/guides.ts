import type { CanvasGuide } from '@open-pencil/scene-graph/guides'

import type { EditorContext } from './types'

function owner(ctx: EditorContext, ownerId: string) {
  const node = ctx.graph.getNode(ownerId)
  return node?.type === 'CANVAS' || node?.type === 'FRAME' || node?.type === 'COMPONENT'
    ? node
    : null
}

function replaceGuides(ctx: EditorContext, ownerId: string, guides: CanvasGuide[]): void {
  const node = ctx.graph.getNode(ownerId)
  if (!node) return
  ctx.graph.updateNode(ownerId, { guides: structuredClone(guides) })
  node.source.editedFields = [...new Set([...node.source.editedFields, 'guides'])]
  ctx.emitEditorEvent('guides:changed', ownerId, structuredClone(guides))
  ctx.requestRender()
}

function newGuideId(): string {
  return `guide:${crypto.randomUUID()}`
}

export function createGuideActions(ctx: EditorContext) {
  function addGuide(ownerId: string, axis: CanvasGuide['axis'], position: number): string | null {
    const node = owner(ctx, ownerId)
    if (!node || !Number.isFinite(position)) return null
    const guide: CanvasGuide = { id: newGuideId(), axis, position }
    const before = structuredClone(node.guides)
    const after = [...before, guide]
    replaceGuides(ctx, ownerId, after)
    ctx.undo.push({
      label: 'Add guide',
      forward: () => replaceGuides(ctx, ownerId, after),
      inverse: () => replaceGuides(ctx, ownerId, before)
    })
    return guide.id
  }

  function moveGuide(ownerId: string, guideId: string, position: number): boolean {
    const node = owner(ctx, ownerId)
    if (!node || !Number.isFinite(position)) return false
    const index = node.guides.findIndex((guide) => guide.id === guideId)
    if (index === -1 || node.guides[index].position === position) return false
    const before = structuredClone(node.guides)
    const after = structuredClone(node.guides)
    after[index].position = position
    replaceGuides(ctx, ownerId, after)
    ctx.undo.push({
      label: 'Move guide',
      forward: () => replaceGuides(ctx, ownerId, after),
      inverse: () => replaceGuides(ctx, ownerId, before)
    })
    return true
  }

  function removeGuide(ownerId: string, guideId: string): boolean {
    const node = owner(ctx, ownerId)
    if (!node) return false
    const before = structuredClone(node.guides)
    const after = before.filter((guide) => guide.id !== guideId)
    if (after.length === before.length) return false
    replaceGuides(ctx, ownerId, after)
    ctx.undo.push({
      label: 'Remove guide',
      forward: () => replaceGuides(ctx, ownerId, after),
      inverse: () => replaceGuides(ctx, ownerId, before)
    })
    return true
  }

  function transferGuide(
    fromOwnerId: string,
    toOwnerId: string,
    guideId: string,
    position: number
  ): boolean {
    const from = owner(ctx, fromOwnerId)
    const to = owner(ctx, toOwnerId)
    const guide = from?.guides.find((candidate) => candidate.id === guideId)
    if (!from || !to || !guide || !Number.isFinite(position)) return false
    const fromBefore = structuredClone(from.guides)
    const toBefore = structuredClone(to.guides)
    const fromAfter = fromBefore.filter((candidate) => candidate.id !== guideId)
    const toAfter = [...toBefore, { ...guide, position }]
    const apply = (fromGuides: CanvasGuide[], toGuides: CanvasGuide[]) => {
      replaceGuides(ctx, fromOwnerId, fromGuides)
      replaceGuides(ctx, toOwnerId, toGuides)
    }
    apply(fromAfter, toAfter)
    ctx.undo.push({
      label: 'Move guide to frame',
      forward: () => apply(fromAfter, toAfter),
      inverse: () => apply(fromBefore, toBefore)
    })
    return true
  }

  return { addGuide, moveGuide, removeGuide, transferGuide }
}

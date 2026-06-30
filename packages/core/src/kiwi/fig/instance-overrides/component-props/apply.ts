import { copyFills, copyStyleRuns } from '@open-pencil/scene-graph/copy'

import { applyOverridePatch, type OverridePatch } from '#core/kiwi/fig/instance-overrides/patches'
import { getComponentRoot } from '#core/kiwi/fig/instance-overrides/resolve'
import type {
  ComponentPropRef,
  ComponentPropValue,
  OverrideContext
} from '#core/kiwi/fig/instance-overrides/types'
import { guidToString } from '#core/kiwi/fig/node-change/convert'

import { propTextCharacters } from './values'

function applyPatchAndMark(
  ctx: OverrideContext,
  childId: string,
  patch: OverridePatch,
  modified?: Set<string>
): void {
  if (applyOverridePatch(ctx, patch)) modified?.add(childId)
}

function applyVisibleProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  if (val.boolValue === undefined) return
  applyPatchAndMark(
    ctx,
    childId,
    { targetId: childId, source: 'component-prop', props: { visible: val.boolValue } },
    modified
  )
}

function applyTextProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  const child = ctx.graph.getNode(childId)
  const text = propTextCharacters(val)
  if (text === undefined || child?.type !== 'TEXT') return
  const source = child.componentId ? ctx.graph.getNode(child.componentId) : null
  const props: Parameters<typeof applyPatchAndMark>[2]['props'] = { text }
  if (source?.type === 'TEXT' && source.text === text) {
    props.width = source.width
    props.height = source.height
    props.fills = copyFills(source.fills)
    props.styleRuns = copyStyleRuns(source.styleRuns)
    props.figmaDerivedTextGlyphs = source.figmaDerivedTextGlyphs
      ? structuredClone(source.figmaDerivedTextGlyphs)
      : undefined
  }
  applyPatchAndMark(ctx, childId, { targetId: childId, source: 'component-prop', props }, modified)
}

function applySwapProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  const swapId =
    propTextCharacters(val) ?? (val.guidValue ? guidToString(val.guidValue) : undefined)
  const newCompId = swapId ? ctx.guidToNodeId.get(swapId) : undefined
  if (!newCompId) return
  applyPatchAndMark(
    ctx,
    childId,
    {
      targetId: childId,
      source: 'component-prop',
      swapComponentId: getComponentRoot(ctx, newCompId)
    },
    modified
  )
}

export function applyComponentPropRef(
  ctx: OverrideContext,
  childId: string,
  ref: ComponentPropRef,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  switch (ref.componentPropNodeField) {
    case 'VISIBLE':
      applyVisibleProp(ctx, childId, val, modified)
      break
    case 'TEXT_DATA':
      applyTextProp(ctx, childId, val, modified)
      break
    case 'OVERRIDDEN_SYMBOL_ID':
      applySwapProp(ctx, childId, val, modified)
      break
  }
}

import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  LAYER_ANIMATION_STYLES,
  slideBuild,
  type LayerAnimation
} from '@open-pencil/scene-graph/slides'

import { getOrCreateNodeGuid, type SceneNodeToKiwiContext } from '../export/context'
import {
  easingActionFields,
  easingFromAction,
  float32Decimal,
  variableOf,
  variableRecord
} from './motion'
import { guidSchema, variableDataSchema } from './schema'

const actionSchema = v.looseObject({
  transitionNodeID: guidSchema,
  animationType: v.picklist(LAYER_ANIMATION_STYLES),
  animationPhase: v.optional(v.picklist(['IN', 'OUT']), 'IN'),
  transitionDuration: v.optional(v.number(), 0),
  easingType: v.optional(v.string()),
  easingFunction: v.optional(v.array(v.number())),
  transitionDurationVar: v.optional(variableDataSchema),
  easingVar: v.optional(variableDataSchema)
})

const recordSchema = v.looseObject({
  isDeleted: v.optional(v.boolean()),
  event: v.optional(v.looseObject({ interactionType: v.optional(v.string()) })),
  actions: v.array(v.unknown())
})

/**
 * Gives the layers of a slide the animations its record keeps. Figma keeps a step per record:
 * the record's event starts its first action, and each further action plays after the one before.
 * Records name layers by GUID, so this waits until every layer of the load exists.
 */
export function linkSlideAnimations(
  graph: SceneGraph,
  record: NodeChange,
  layerOf: (sourceId: string) => string | undefined
): void {
  if (!Array.isArray(record.objectAnimations)) return
  let order = 0
  for (const entry of record.objectAnimations) {
    const parsed = v.safeParse(recordSchema, entry)
    if (!parsed.success || parsed.output.isDeleted) continue
    const onClick = (parsed.output.event?.interactionType ?? 'ON_CLICK') === 'ON_CLICK'
    for (const [index, raw] of parsed.output.actions.entries()) {
      const action = v.safeParse(actionSchema, raw)
      if (!action.success) continue
      const layerId = layerOf(guidToString(action.output.transitionNodeID))
      if (!layerId) continue
      const durationVariableId = variableOf(action.output.transitionDurationVar)
      const easingVariableId = variableOf(action.output.easingVar)
      const animation: LayerAnimation = {
        style: action.output.animationType,
        phase: action.output.animationPhase,
        trigger: index === 0 && onClick ? 'ON_CLICK' : 'AFTER_PREVIOUS',
        duration: float32Decimal(action.output.transitionDuration),
        easing: easingFromAction(action.output.easingType, action.output.easingFunction),
        ...(durationVariableId && { durationVariableId }),
        ...(easingVariableId && { easingVariableId }),
        order: order++
      }
      graph.updateNode(layerId, { animation })
    }
  }
}

/** The records Figma keeps for a slide's animations: a record per step of its build. */
export function animationRecords(
  context: SceneNodeToKiwiContext,
  slide: SceneNode,
  localIdCounter: { value: number }
): unknown[] {
  return slideBuild(context.graph, slide.id).map((step) => ({
    id: { sessionID: 1, localID: localIdCounter.value++ },
    // A first step that plays as the slide appears has no click to wait for.
    event: step.onClick
      ? { interactionType: 'ON_CLICK' }
      : { interactionType: 'AFTER_TIMEOUT', transitionTimeout: 0 },
    actions: step.layers.flatMap(({ id, animation }) => {
      const guid = getOrCreateNodeGuid(context, id, localIdCounter)
      if (!guid) return []
      const durationVar = variableRecord(context, animation.durationVariableId)
      const easingVar = variableRecord(context, animation.easingVariableId)
      return [
        {
          transitionNodeID: guid,
          transitionDuration: animation.duration,
          ...easingActionFields(animation.easing),
          ...(durationVar !== undefined && { transitionDurationVar: durationVar }),
          ...(easingVar !== undefined && { easingVar }),
          connectionType: 'OBJECT_ANIMATION',
          animationType: animation.style,
          animationPhase: animation.phase
        }
      ]
    }),
    isDeleted: false,
    stateManagementVersion: 1
  }))
}

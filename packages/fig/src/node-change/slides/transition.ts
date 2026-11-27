import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  nextSlide,
  SLIDE_TRANSITION_STYLES,
  type SlideTransition,
  type SlideTransitionTiming
} from '@open-pencil/scene-graph/slides'

import {
  getOrCreateNodeGuid,
  type KiwiNodeChange,
  type SceneNodeToKiwiContext
} from '../export/context'
import {
  easingActionFields,
  easingFromAction,
  float32Decimal,
  variableOf,
  variableRecord
} from './motion'
import { guidSchema, variableDataSchema } from './schema'

const transitionSchema = v.looseObject({
  id: v.optional(guidSchema),
  isDeleted: v.optional(v.boolean()),
  event: v.looseObject({
    interactionType: v.picklist(['ON_CLICK', 'AFTER_TIMEOUT']),
    transitionTimeout: v.optional(v.number(), 0),
    transitionTimeoutVar: v.optional(variableDataSchema)
  }),
  actions: v.pipe(
    v.array(
      v.looseObject({
        navigationType: v.literal('NAVIGATE'),
        transitionType: v.picklist(['INSTANT_TRANSITION', ...SLIDE_TRANSITION_STYLES]),
        transitionDuration: v.optional(v.number(), 0),
        easingType: v.optional(v.string(), 'OUT_CUBIC'),
        easingFunction: v.optional(v.array(v.number())),
        transitionDurationVar: v.optional(variableDataSchema),
        easingVar: v.optional(variableDataSchema)
      })
    ),
    v.length(1)
  )
})

/** Which of a slide's interactions is its transition: the first that moves the deck on. */
function transitionInteraction(interactions: unknown) {
  if (!Array.isArray(interactions)) return undefined
  for (const [index, interaction] of interactions.entries()) {
    const parsed = v.safeParse(transitionSchema, interaction)
    if (parsed.success && !parsed.output.isDeleted) return { index, record: parsed.output }
  }
  return undefined
}

function timingOf(event: v.InferOutput<typeof transitionSchema>['event']): SlideTransitionTiming {
  if (event.interactionType === 'ON_CLICK') return { type: 'ON_CLICK' }
  const delayVariableId = variableOf(event.transitionTimeoutVar)
  return {
    type: 'AFTER_DELAY',
    delay: float32Decimal(event.transitionTimeout),
    ...(delayVariableId && { delayVariableId })
  }
}

export function extractTransition(nc: NodeChange): SlideTransition | null {
  const record = transitionInteraction(nc.prototypeInteractions)?.record
  if (!record) return null
  const [action] = record.actions
  const durationVariableId = variableOf(action.transitionDurationVar)
  const easingVariableId = variableOf(action.easingVar)
  return {
    style: action.transitionType === 'INSTANT_TRANSITION' ? 'NONE' : action.transitionType,
    duration: float32Decimal(action.transitionDuration),
    easing: easingFromAction(action.easingType, action.easingFunction),
    ...(durationVariableId && { durationVariableId }),
    ...(easingVariableId && { easingVariableId }),
    timing: timingOf(record.event)
  }
}

/** Fields that `defined` keeps, and that are dropped from a saved record when it has none. */
function withFields(
  saved: Record<string, unknown> | undefined,
  defined: Record<string, unknown>
): Record<string, unknown> {
  const unset = Object.keys(defined).filter((key) => defined[key] === undefined)
  const set = Object.fromEntries(Object.entries(defined).filter(([, value]) => value !== undefined))
  return { ...omit(saved ?? {}, unset), ...set }
}

function eventRecord(
  context: SceneNodeToKiwiContext,
  { timing }: SlideTransition,
  saved: Record<string, unknown> | undefined
) {
  return withFields(
    saved,
    timing.type === 'ON_CLICK'
      ? { interactionType: 'ON_CLICK', transitionTimeout: 0, transitionTimeoutVar: undefined }
      : {
          interactionType: 'AFTER_TIMEOUT',
          transitionTimeout: timing.delay,
          transitionTimeoutVar: variableRecord(context, timing.delayVariableId)
        }
  )
}

/**
 * A slide's interactions with `transition` in place of the one that moves the deck on. It targets
 * the slide the grid shows next, and at the end the slide itself, as Figma writes both.
 */
export function transitionInteractions(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange,
  transition: SlideTransition | null,
  localIdCounter: { value: number }
): unknown[] {
  const saved = node.source.fig.rawNodeFields.prototypeInteractions
  const previous = transitionInteraction(saved)
  const interactions: unknown[] = Array.isArray(saved) ? [...saved] : []
  if (!transition) {
    if (previous) interactions.splice(previous.index, 1)
    return interactions
  }
  const target = nextSlide(context.graph, context.graph.getNode(node.id) ?? node)
  const targetGuid = target && getOrCreateNodeGuid(context, target.id, localIdCounter)
  const action = withFields(
    {
      connectionType: 'INTERNAL_NODE',
      navigationType: 'NAVIGATE',
      transitionResetVideoPosition: true,
      ...previous?.record.actions[0]
    },
    {
      transitionNodeID: targetGuid ?? nc.guid,
      transitionType: transition.style === 'NONE' ? 'INSTANT_TRANSITION' : transition.style,
      transitionDuration: transition.duration,
      easingFunction: undefined,
      ...easingActionFields(transition.easing),
      transitionDurationVar: variableRecord(context, transition.durationVariableId),
      easingVar: variableRecord(context, transition.easingVariableId)
    }
  )
  const interaction = {
    ...previous?.record,
    id: previous?.record.id ?? { sessionID: 1, localID: localIdCounter.value++ },
    event: eventRecord(context, transition, previous?.record.event),
    actions: [action],
    isDeleted: false,
    stateManagementVersion: 1
  }
  interactions.splice(previous?.index ?? interactions.length, previous ? 1 : 0, interaction)
  return interactions
}

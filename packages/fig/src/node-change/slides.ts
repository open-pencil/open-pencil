import { partition } from 'es-toolkit/array'
import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  nextSlide,
  SLIDE_TRANSITION_STYLES,
  slideSettings,
  type SlideSettings,
  type SlideTransition,
  type SlideTransitionCurve
} from '@open-pencil/scene-graph/slides'

import { readEffectiveFigmaRawField } from '../source-metadata'
import {
  getOrCreateNodeGuid,
  type KiwiNodeChange,
  type SceneNodeToKiwiContext
} from './export/context'

/** Figma's record names for the easings a slide transition offers. */
const CURVE_EASINGS = {
  EASE_IN: 'IN_CUBIC',
  EASE_OUT: 'OUT_CUBIC',
  EASE_IN_AND_OUT: 'INOUT_CUBIC',
  LINEAR: 'LINEAR',
  GENTLE: 'GENTLE_SPRING',
  QUICK: 'SPRING_PRESET_ONE',
  BOUNCY: 'SPRING_PRESET_TWO',
  SLOW: 'SPRING_PRESET_THREE'
} as const satisfies Record<SlideTransitionCurve, string>

const EASING_CURVES = new Map<string, SlideTransitionCurve>(
  Object.entries(CURVE_EASINGS).map(([curve, easing]) => [easing, curve as SlideTransitionCurve])
)

const guidSchema = v.object({ sessionID: v.number(), localID: v.number() })

const transitionSchema = v.looseObject({
  id: v.optional(guidSchema),
  isDeleted: v.optional(v.boolean()),
  event: v.looseObject({
    interactionType: v.picklist(['ON_CLICK', 'AFTER_TIMEOUT']),
    transitionTimeout: v.optional(v.number(), 0)
  }),
  actions: v.pipe(
    v.array(
      v.looseObject({
        navigationType: v.literal('NAVIGATE'),
        transitionType: v.picklist(['INSTANT_TRANSITION', ...SLIDE_TRANSITION_STYLES]),
        transitionDuration: v.optional(v.number(), 0),
        easingType: v.optional(v.string(), 'OUT_CUBIC')
      })
    ),
    v.length(1)
  )
})

const animationSchema = v.looseObject({
  actions: v.array(v.looseObject({ transitionNodeID: v.optional(guidSchema) }))
})

/** The parts of Figma's Lexical notes that hold their text. */
interface NotesNode {
  type?: string
  text?: string
  children?: NotesNode[]
}
const notesNodeSchema: v.GenericSchema<NotesNode> = v.looseObject({
  type: v.optional(v.string()),
  text: v.optional(v.string()),
  children: v.optional(v.array(v.lazy(() => notesNodeSchema)))
})
const notesSchema = v.pipe(v.string(), v.parseJson(), v.object({ root: notesNodeSchema }))

function notesText(node: NotesNode): string {
  if (node.type === 'linebreak') return '\n'
  return node.text ?? (node.children ?? []).map(notesText).join('')
}

/** Notes as plain text, a line for each block; a list's items, nested ones too, are blocks. */
function notesLines(node: NotesNode): string[] {
  return (node.children ?? []).flatMap((child) => {
    if (child.type === 'list') return notesLines(child)
    const [lists, inline] = partition(child.children ?? [], ({ type }) => type === 'list')
    if (lists.length === 0) return [notesText(child)]
    const text = inline.map(notesText).join('')
    return [...(text ? [text] : []), ...lists.flatMap(notesLines)]
  })
}

function extractNotes(value: unknown): string {
  const parsed = v.safeParse(notesSchema, value)
  return parsed.success ? notesLines(parsed.output.root).join('\n') : ''
}

/** The record Figma's notes editor writes for plain paragraphs. */
function notesRecord(notes: string): string {
  const block = { direction: null, format: '', indent: 0, version: 1 }
  const paragraphs = notes.split('\n').map((text) => ({
    children: text
      ? [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }]
      : [],
    ...block,
    type: 'paragraph',
    textFormat: 0,
    textStyle: ''
  }))
  return JSON.stringify({ root: { children: paragraphs, ...block, type: 'root' } })
}

/** Which of a slide's interactions is its transition: the first that moves the deck on. */
function transitionInteraction(interactions: unknown) {
  if (!Array.isArray(interactions)) return undefined
  for (const [index, interaction] of interactions.entries()) {
    const parsed = v.safeParse(transitionSchema, interaction)
    if (parsed.success && !parsed.output.isDeleted) return { index, record: parsed.output }
  }
  return undefined
}

function extractTransition(nc: NodeChange): SlideTransition | null {
  const record = transitionInteraction(nc.prototypeInteractions)?.record
  if (!record) return null
  const { event } = record
  const [action] = record.actions
  return {
    style: action.transitionType === 'INSTANT_TRANSITION' ? 'NONE' : action.transitionType,
    duration: action.transitionDuration,
    curve: EASING_CURVES.get(action.easingType) ?? 'EASE_OUT',
    timing:
      event.interactionType === 'ON_CLICK'
        ? { type: 'ON_CLICK' }
        : { type: 'AFTER_DELAY', delay: event.transitionTimeout }
  }
}

/** What a slide's record keeps besides its layers; null for any other record. */
export function extractSlideSettings(nc: NodeChange): SlideSettings | null {
  if (nc.type !== 'SLIDE') return null
  return {
    skipped: nc.isSkippedSlide === true,
    notes: extractNotes(nc.slideSpeakerNotes),
    transition: extractTransition(nc)
  }
}

function eventFields({ timing }: SlideTransition) {
  return timing.type === 'ON_CLICK'
    ? { interactionType: 'ON_CLICK', transitionTimeout: 0 }
    : { interactionType: 'AFTER_TIMEOUT', transitionTimeout: timing.delay }
}

/** The curve's easing; one Figma's panel does not offer, read as Ease out, stays as it was saved. */
function easingRecord(curve: SlideTransitionCurve, saved: string | undefined): string {
  if (saved !== undefined && !EASING_CURVES.has(saved) && curve === 'EASE_OUT') return saved
  return CURVE_EASINGS[curve]
}

/**
 * A slide's interactions with `transition` in place of the one that moves the deck on. It targets
 * the slide the grid shows next, and at the end the slide itself, as Figma writes both.
 */
function transitionInteractions(
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
  const interaction = {
    ...previous?.record,
    id: previous?.record.id ?? { sessionID: 1, localID: localIdCounter.value++ },
    event: { ...previous?.record.event, ...eventFields(transition) },
    actions: [
      {
        connectionType: 'INTERNAL_NODE',
        navigationType: 'NAVIGATE',
        transitionResetVideoPosition: true,
        ...previous?.record.actions[0],
        transitionNodeID: targetGuid ?? nc.guid,
        transitionType: transition.style === 'NONE' ? 'INSTANT_TRANSITION' : transition.style,
        transitionDuration: transition.duration,
        easingType: easingRecord(transition.curve, previous?.record.actions[0].easingType)
      }
    ],
    isDeleted: false,
    stateManagementVersion: 1
  }
  interactions.splice(previous?.index ?? interactions.length, previous ? 1 : 0, interaction)
  return interactions
}

/** The animations of layers still inside the slide: a copy's records name the original's. */
function ownAnimations(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  animations: readonly unknown[],
  localIdCounter: { value: number }
): unknown[] {
  const guids = new Set<string>()
  const visit = (id: string) => {
    for (const child of context.graph.getChildren(id)) {
      const guid = getOrCreateNodeGuid(context, child.id, localIdCounter)
      if (guid) guids.add(guidToString(guid))
      visit(child.id)
    }
  }
  visit(node.id)
  return animations.filter((animation) => {
    const parsed = v.safeParse(animationSchema, animation)
    return (
      parsed.success &&
      parsed.output.actions.every(
        ({ transitionNodeID }) => transitionNodeID && guids.has(guidToString(transitionNodeID))
      )
    )
  })
}

/** Writes what a slide keeps besides its layers as Figma reads it. */
export function serializeSlide(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange,
  localIdCounter: { value: number }
): void {
  const slide = slideSettings(node)
  if (!slide) return
  // Figma writes the flag only on a slide that was ever skipped.
  if (slide.skipped || nc.isSkippedSlide !== undefined) nc.isSkippedSlide = slide.skipped
  else delete nc.isSkippedSlide
  const saved = readEffectiveFigmaRawField(node, 'slideSpeakerNotes')
  // Notes nobody edited keep the formatting the file has.
  if (extractNotes(saved) !== slide.notes) {
    if (slide.notes) nc.slideSpeakerNotes = notesRecord(slide.notes)
    else delete nc.slideSpeakerNotes
  }
  const interactions = transitionInteractions(context, node, nc, slide.transition, localIdCounter)
  if (interactions.length > 0) nc.prototypeInteractions = interactions
  else delete nc.prototypeInteractions
  if (Array.isArray(nc.objectAnimations)) {
    nc.objectAnimations = ownAnimations(context, node, nc.objectAnimations, localIdCounter)
  }
}

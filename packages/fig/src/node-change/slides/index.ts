import { readEffectiveFigmaRawField } from '#fig/source-metadata'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'
import { slideSettings, type SlideSettings } from '@open-pencil/scene-graph/slides'

import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'
import { animationRecords } from './animations'
import { extractNotes, notesRecord } from './notes'
import { extractTransition, transitionInteractions } from './transition'

export { linkSlideAnimations } from './animations'

/** What a slide's record keeps besides its layers; null for any other record. */
export function extractSlideSettings(nc: NodeChange): SlideSettings | null {
  if (nc.type !== 'SLIDE') return null
  return {
    skipped: nc.isSkippedSlide === true,
    notes: extractNotes(nc.slideSpeakerNotes),
    transition: extractTransition(nc)
  }
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
  // Animations live on the layers they move, so a copied slide or layer keeps them.
  const animations = animationRecords(context, node, localIdCounter)
  if (animations.length > 0) nc.objectAnimations = animations
  else delete nc.objectAnimations
}

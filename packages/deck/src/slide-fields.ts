import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/**
 * SLIDE fields the scene graph has no place for, carried verbatim across a round-trip.
 *
 * A deck's page becomes a CANVAS on import and a SLIDE again on export, and anything not
 * modelled in between is lost unless it rides along. Speaker notes and slide transitions
 * are authored content — losing them on open-and-save would be silent data loss — and the
 * identity fields keep a slide recognisable to Figma as the same slide.
 */
export const CARRIED_SLIDE_FIELDS = [
  'slideSpeakerNotes',
  'prototypeInteractions',
  'overrideKey',
  'editInfo',
  'sourceLibraryKey'
] as const

export type CarriedSlideField = (typeof CARRIED_SLIDE_FIELDS)[number]

export type CarriedSlideFields = Partial<Pick<NodeChange, CarriedSlideField>>

/** The carried fields present on a node, ready to spread onto its counterpart. */
export function pickCarriedSlideFields(nc: NodeChange | undefined): CarriedSlideFields {
  if (!nc) return {}
  const carried: CarriedSlideFields = {}
  for (const field of CARRIED_SLIDE_FIELDS) {
    if (nc[field] !== undefined) Object.assign(carried, { [field]: nc[field] })
  }
  return carried
}

/** The same node without any slide-only field, for nodes that are not slides. */
export function withoutCarriedSlideFields(nc: NodeChange): NodeChange {
  const carried = new Set<string>(CARRIED_SLIDE_FIELDS)
  return Object.fromEntries(Object.entries(nc).filter(([key]) => !carried.has(key))) as NodeChange
}

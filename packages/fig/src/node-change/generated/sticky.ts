import { pick } from 'es-toolkit'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  buildStickySublayers,
  STICKY_SUBLAYER_LAYOUT,
  stickyFrameFields,
  stickyScale,
  stickySublayers
} from '@open-pencil/scene-graph/generated'

import { nodeChangeToProps } from '../convert'
import { createFillPaints } from '../export/context'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'
import { convertFills } from '../paint'
import type { GeneratedFrameCodec } from './codec'
import { placement, shaped, sublayerRecord, textSublayer } from './entries'
import {
  derivedFrameEntriesOf,
  generatedSlotPath,
  generationOverridesOf,
  type GeneratedEntry
} from './records'

export const STICKY_SLOTS = { background: 0, body: 1, author: 2 } as const

/**
 * The fields a STICKY's own record keeps, as Figma writes it. Its colour, text and layout live in
 * its sublayers' entries, so the fields the note carries here as an auto layout frame stay out.
 */
const STICKY_RECORD_FIELDS = [
  'guid',
  'parentIndex',
  'phase',
  'type',
  'name',
  'visible',
  'opacity',
  'blendMode',
  'locked',
  'size',
  'transform',
  'effects',
  'autoRename',
  'frameMaskDisabled',
  'exportSettings',
  'pluginData',
  'pluginRelaunchData'
] as const

function sublayerProps(
  entry: GeneratedEntry | undefined,
  derived: GeneratedEntry | undefined,
  blobs: Uint8Array[]
): Partial<SceneNode> {
  const {
    nodeType: _type,
    name: _name,
    ...props
  } = nodeChangeToProps(sublayerRecord('TEXT', entry, derived), blobs, 'occurrence')
  return { ...props, ...STICKY_SUBLAYER_LAYOUT }
}

/**
 * Gives an imported STICKY the sublayers its record describes. The note's colour is its
 * background's fill, which the note itself carries here; its layout comes from the template at
 * the scale its author line was set in.
 */
function readSticky(
  graph: SceneGraph,
  sticky: SceneNode,
  record: NodeChange,
  blobs: Uint8Array[]
): void {
  const overrides = generationOverridesOf(record)
  const derived = derivedFrameEntriesOf(record)
  const { background, body, author } = STICKY_SLOTS
  const bodyProps = sublayerProps(overrides.get(body), derived.get(body), blobs)
  const authorProps = sublayerProps(overrides.get(author), derived.get(author), blobs)
  const scale = overrides.has(author) ? stickyScale({ fontSize: authorProps.fontSize ?? 0 }) : 1
  graph.updateNode(sticky.id, {
    fills: convertFills(overrides.get(background)?.fillPaints),
    ...stickyFrameFields(scale)
  })
  buildStickySublayers(graph, sticky, { scale }, { body: bodyProps, author: authorProps })
}

/**
 * A generated frame's record, with its sublayers written on it as Figma stores a sticky note: what
 * each sublayer shows under `nodeGenerationData`, and the layout derived from it under
 * `derivedImmutableFrameData`. Figma draws a note from its derived data as saved and lays it out
 * afresh only without it, so the export writes that data only when it has shaped every text.
 */
function writeSticky(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): KiwiNodeChange {
  const sublayers = stickySublayers(context.graph, node)
  if (!sublayers) return nc
  const record: KiwiNodeChange = pick(nc, STICKY_RECORD_FIELDS)
  const fillPaints = createFillPaints(context, node)
  const background: GeneratedEntry = {
    guidPath: generatedSlotPath(STICKY_SLOTS.background),
    fillPaints,
    cornerRadius: 0
  }
  const overrides: GeneratedEntry[] = [background]
  const derived: GeneratedEntry[] = [
    { guidPath: generatedSlotPath(STICKY_SLOTS.background), ...placement({ ...node, x: 0, y: 0 }) }
  ]
  let complete = true
  for (const [slot, layer] of [
    [STICKY_SLOTS.body, sublayers.body],
    [STICKY_SLOTS.author, sublayers.author]
  ] as const) {
    const text = textSublayer(context, slot, layer)
    overrides.push(text.entry)
    derived.push(text.derived)
    complete &&= shaped(layer, text.derived)
  }
  record.nodeGenerationData = { overrides, useFineGrainedSyncing: false, diffOnlyRemovals: [] }
  if (complete) record.derivedImmutableFrameData = { overrides: derived, version: 1 }
  return record
}

/** A sticky note: its colour on a background slot, and its body and author as text slots. */
export const STICKY_CODEC: GeneratedFrameCodec = { read: readSticky, write: writeSticky }

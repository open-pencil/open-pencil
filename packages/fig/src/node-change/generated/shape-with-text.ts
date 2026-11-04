import { omit, pick } from 'es-toolkit'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  buildShapeWithTextLabel,
  SHAPE_WITH_TEXT_LABEL_LAYOUT,
  shapeWithTextFrameFields,
  shapeWithTextLabel
} from '@open-pencil/scene-graph/generated'

import { cloneRecord } from '../clone'
import { nodeChangeToProps } from '../convert'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'
import type { GeneratedFrameCodec } from './codec'
import { placement, shaped, sublayerRecord, textSublayer } from './entries'
import {
  derivedFrameEntriesOf,
  generatedSlotPath,
  generationOverridesOf,
  type GeneratedEntry
} from './records'

/** Where FigJam keeps a shape with text's parts: its paint on the background, its text on the label. */
export const SHAPE_WITH_TEXT_SLOTS = { background: 0, label: 1 } as const

/**
 * The fields a SHAPE_WITH_TEXT's own record keeps, as FigJam writes it. Its paint, corners and
 * effects live on its background and its text on its label, and the auto layout that only places
 * the label stays out.
 */
const SHAPE_WITH_TEXT_RECORD_FIELDS = [
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
  'autoRename',
  'frameMaskDisabled',
  'exportSettings',
  'pluginData',
  'pluginRelaunchData'
] as const

/** The label's sizing, which layout sets from the shape and FigJam's label record leaves out. */
const LABEL_LAYOUT_FIELDS = ['textAutoResize', 'textTruncation', 'maxLines'] as const

/** What a shape with text's background keeps: the shape's own paint, corners and effects. */
const SHAPE_WITH_TEXT_BACKGROUND_FIELDS = [
  'fillPaints',
  'strokePaints',
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'dashPattern',
  'effects',
  'styleIdForFill',
  'styleIdForStrokeFill',
  'styleIdForEffect'
] as const

/** A shape with text's paint, corners and effects, as its background holds them. */
function backgroundProps(
  entry: GeneratedEntry | undefined,
  blobs: Uint8Array[]
): Partial<SceneNode> {
  if (!entry) return {}
  const { guidPath: _slot, ...fields } = cloneRecord(entry)
  const props = nodeChangeToProps({ ...fields, type: 'RECTANGLE' }, blobs, 'occurrence')
  return pick(props, [
    'fills',
    'strokes',
    'strokeWeight',
    'strokeAlign',
    'strokeCap',
    'strokeJoin',
    'dashPattern',
    'cornerRadius',
    'effects',
    'fillStyleId',
    'strokeStyleId',
    'effectStyleId'
  ])
}

function labelProps(
  entry: GeneratedEntry | undefined,
  derived: GeneratedEntry | undefined,
  blobs: Uint8Array[]
): Partial<SceneNode> {
  if (!entry) return {}
  const {
    nodeType: _type,
    name: _name,
    ...props
  } = nodeChangeToProps(sublayerRecord('TEXT', entry, derived), blobs, 'occurrence')
  return { ...props, ...SHAPE_WITH_TEXT_LABEL_LAYOUT }
}

/**
 * Gives an imported SHAPE_WITH_TEXT its paint from its background and its label, centred in the
 * label area of its kind. A shape without a generated label gets an empty one, which typing fills.
 */
function readShapeWithText(
  graph: SceneGraph,
  shape: SceneNode,
  record: NodeChange,
  blobs: Uint8Array[]
): void {
  const { background, label } = SHAPE_WITH_TEXT_SLOTS
  const overrides = generationOverridesOf(record)
  graph.updateNode(shape.id, {
    ...backgroundProps(overrides.get(background), blobs),
    shapeUserHeight: shape.shapeUserHeight > 0 ? shape.shapeUserHeight : shape.height,
    ...shapeWithTextFrameFields(shape.shapeWithTextType, shape.width, shape.height)
  })
  const derived = derivedFrameEntriesOf(record).get(label)
  buildShapeWithTextLabel(graph, shape, labelProps(overrides.get(label), derived, blobs))
}

/**
 * A shape with text's record as FigJam writes it: its kind on it, its paint on its generated
 * background and its text on its generated label, with the derived layout when the label is shaped.
 */
function writeShapeWithText(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): KiwiNodeChange {
  const label = shapeWithTextLabel(context.graph, node)
  if (!label) return nc
  const record: KiwiNodeChange = pick(nc, SHAPE_WITH_TEXT_RECORD_FIELDS)
  record.shapeWithTextType = node.shapeWithTextType
  if (node.shapeUserHeight > 0) record.shapeUserHeight = node.shapeUserHeight
  if (node.shapeTruncates) record.shapeTruncates = true
  const slots = SHAPE_WITH_TEXT_SLOTS
  const background: GeneratedEntry = {
    guidPath: generatedSlotPath(slots.background),
    ...pick(nc, SHAPE_WITH_TEXT_BACKGROUND_FIELDS),
    cornerRadius: node.cornerRadius
  }
  const text = textSublayer(context, slots.label, label)
  record.nodeGenerationData = {
    // FigJam sizes and truncates the label from the shape itself, so its own sizing stays out.
    overrides: [background, omit(text.entry, LABEL_LAYOUT_FIELDS)],
    useFineGrainedSyncing: false,
    diffOnlyRemovals: []
  }
  if (shaped(label, text.derived)) {
    const backgroundPlacement: GeneratedEntry = {
      guidPath: generatedSlotPath(slots.background),
      ...placement({ ...node, x: 0, y: 0 })
    }
    record.derivedImmutableFrameData = {
      overrides: [backgroundPlacement, text.derived],
      version: 1
    }
  }
  return record
}

/** A FigJam shape with text: its paint on a background slot, and its label as a text slot. */
export const SHAPE_WITH_TEXT_CODEC: GeneratedFrameCodec = {
  read: readShapeWithText,
  write: writeShapeWithText
}

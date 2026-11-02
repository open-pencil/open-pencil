import { groupBy } from 'es-toolkit'

import { UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import type { SceneNode } from '@open-pencil/scene-graph'

/** The style reference Figma writes for a style an instance has cleared. */
export const CLEARED_STYLE = { guid: { ...UNSET_GUID } }

/**
 * How a claim on a raw Kiwi field maps onto SceneGraph. Materialization records the
 * mapped scene fields as overridden, uniform scale multiplies `length` values, and
 * export serializes each `kind` back into the raw field.
 */
export interface OverrideField {
  readonly scene: readonly (keyof SceneNode)[]
  readonly kind:
    | 'scalar'
    | 'visible'
    | 'text'
    | 'text-style'
    | 'paint'
    | 'size'
    | 'layout-distance'
    | 'layout-mode'
    | 'node'
  /** A placed-space distance that an instance's uniform scale multiplies. */
  readonly length?: true
  /**
   * For `node` claims: the value Figma reads when the record leaves the field out, written
   * explicitly so a claim of the default still overrides the component.
   */
  readonly absent?: unknown
}

/** Raw override fields an instance owner may claim, keyed by their Kiwi name. */
export const OVERRIDE_FIELDS = {
  name: { scene: ['name'], kind: 'scalar' },
  opacity: { scene: ['opacity'], kind: 'scalar' },
  fontSize: { scene: ['fontSize'], kind: 'scalar', length: true },
  visible: { scene: ['visible'], kind: 'visible' },
  variableModeBySetMap: { scene: ['variableModes'], kind: 'node', absent: { entries: [] } },
  // Figma claims styled ranges and list lines with the characters (desktop 126).
  textData: { scene: ['text', 'styleRuns', 'textParagraphs'], kind: 'text' },
  styleIdForText: { scene: ['textStyleId'], kind: 'text-style' },
  fillPaints: { scene: ['fills'], kind: 'paint' },
  strokePaints: { scene: ['strokes'], kind: 'paint' },
  size: { scene: ['width', 'height'], kind: 'size', length: true },
  stackSpacing: { scene: ['itemSpacing'], kind: 'layout-distance', length: true },
  stackCounterSpacing: { scene: ['counterAxisSpacing'], kind: 'layout-distance', length: true },
  stackHorizontalPadding: { scene: ['paddingLeft'], kind: 'layout-distance', length: true },
  stackVerticalPadding: { scene: ['paddingTop'], kind: 'layout-distance', length: true },
  stackPaddingRight: { scene: ['paddingRight'], kind: 'layout-distance', length: true },
  stackPaddingBottom: { scene: ['paddingBottom'], kind: 'layout-distance', length: true },
  textAutoResize: { scene: ['textAutoResize'], kind: 'layout-mode' },
  stackChildPrimaryGrow: { scene: ['layoutGrow'], kind: 'layout-mode' },
  stackPrimarySizing: { scene: ['primaryAxisSizing'], kind: 'layout-mode' },
  stackCounterSizing: { scene: ['counterAxisSizing'], kind: 'layout-mode' },
  stackChildAlignSelf: { scene: ['layoutAlignSelf'], kind: 'layout-mode' },
  // Claimed as the layer's own record writes them (Figma desktop 126 claim encoding).
  cornerRadius: { scene: ['cornerRadius'], kind: 'node', length: true, absent: 0 },
  rectangleTopLeftCornerRadius: { scene: ['topLeftRadius'], kind: 'node', length: true, absent: 0 },
  rectangleTopRightCornerRadius: {
    scene: ['topRightRadius'],
    kind: 'node',
    length: true,
    absent: 0
  },
  rectangleBottomRightCornerRadius: {
    scene: ['bottomRightRadius'],
    kind: 'node',
    length: true,
    absent: 0
  },
  rectangleBottomLeftCornerRadius: {
    scene: ['bottomLeftRadius'],
    kind: 'node',
    length: true,
    absent: 0
  },
  rectangleCornerRadiiIndependent: { scene: ['independentCorners'], kind: 'node', absent: false },
  cornerSmoothing: { scene: ['cornerSmoothing'], kind: 'node', absent: 0 },
  strokeWeight: { scene: ['strokeWeight'], kind: 'node', length: true },
  strokeAlign: { scene: ['strokeAlign'], kind: 'node', absent: 'CENTER' },
  borderTopWeight: { scene: ['borderTopWeight'], kind: 'node', length: true },
  borderRightWeight: { scene: ['borderRightWeight'], kind: 'node', length: true },
  borderBottomWeight: { scene: ['borderBottomWeight'], kind: 'node', length: true },
  borderLeftWeight: { scene: ['borderLeftWeight'], kind: 'node', length: true },
  borderStrokeWeightsIndependent: {
    scene: ['independentStrokeWeights'],
    kind: 'node',
    absent: false
  },
  strokeCap: { scene: ['strokeCap'], kind: 'node', absent: 'NONE' },
  strokeJoin: { scene: ['strokeJoin'], kind: 'node', absent: 'MITER' },
  miterLimit: { scene: ['strokeMiterLimit'], kind: 'node' },
  dashPattern: { scene: ['dashPattern'], kind: 'node', length: true, absent: [] },
  blendMode: { scene: ['blendMode'], kind: 'node', absent: 'PASS_THROUGH' },
  effects: { scene: ['effects'], kind: 'node', absent: [] },
  locked: { scene: ['locked'], kind: 'node', absent: false },
  layoutGrids: { scene: ['layoutGrids'], kind: 'node', absent: [] },
  // An instance that clears a style the component applies claims the unset GUID (desktop 126).
  styleIdForFill: { scene: ['fillStyleId'], kind: 'node', absent: CLEARED_STYLE },
  styleIdForStrokeFill: { scene: ['strokeStyleId'], kind: 'node', absent: CLEARED_STYLE },
  styleIdForEffect: { scene: ['effectStyleId'], kind: 'node', absent: CLEARED_STYLE },
  stackPrimaryAlignItems: { scene: ['primaryAxisAlign'], kind: 'node' },
  stackCounterAlignItems: { scene: ['counterAxisAlign'], kind: 'node' },
  stackPositioning: { scene: ['layoutPositioning'], kind: 'node' },
  fontName: { scene: ['fontFamily', 'fontWeight', 'italic', 'fontStyle'], kind: 'node' },
  fontVariations: { scene: ['fontVariations'], kind: 'node', absent: [] },
  detachOpticalSizeFromFontSize: {
    scene: ['opticalSizeFromFontSize'],
    kind: 'node',
    absent: false
  },
  lineHeight: { scene: ['lineHeight'], kind: 'node', absent: { value: 100, units: 'PERCENT' } },
  letterSpacing: { scene: ['letterSpacing'], kind: 'node' },
  paragraphSpacing: { scene: ['paragraphSpacing'], kind: 'node', length: true, absent: 0 },
  textCase: { scene: ['textCase'], kind: 'node', absent: 'ORIGINAL' },
  textDecoration: { scene: ['textDecoration'], kind: 'node', absent: 'NONE' },
  textAlignHorizontal: { scene: ['textAlignHorizontal'], kind: 'node' },
  textAlignVertical: { scene: ['textAlignVertical'], kind: 'node' },
  textTruncation: { scene: ['textTruncation'], kind: 'node', absent: 'DISABLED' },
  maxLines: { scene: ['maxLines'], kind: 'node' }
} as const satisfies Record<string, OverrideField>

export type RawOverrideField = keyof typeof OVERRIDE_FIELDS

type RawFieldOfKind<K extends OverrideField['kind']> = {
  [R in RawOverrideField]: (typeof OVERRIDE_FIELDS)[R]['kind'] extends K ? R : never
}[RawOverrideField]

const entries = Object.entries(OVERRIDE_FIELDS) as [RawOverrideField, OverrideField][]

/** Scene fields that carry an instance override, with the raw fields each serializes to. */
export const SCENE_OVERRIDE_FIELDS: ReadonlyMap<
  keyof SceneNode,
  readonly { raw: RawOverrideField; field: OverrideField }[]
> = new Map(
  Object.entries(
    groupBy(
      entries.flatMap(([raw, field]) => field.scene.map((scene) => ({ scene, raw, field }))),
      (entry) => entry.scene
    )
  ).map(([scene, claims]) => [
    scene as keyof SceneNode,
    claims.map(({ raw, field }) => ({ raw, field }))
  ])
)

function rawFieldsOfKind<K extends OverrideField['kind']>(kind: K): RawFieldOfKind<K>[] {
  return entries.flatMap(([raw, field]) => (field.kind === kind ? [raw as RawFieldOfKind<K>] : []))
}

/** Scalars share one name on both sides and serialize verbatim. */
export const SCALAR_OVERRIDE_FIELDS: readonly RawFieldOfKind<'scalar'>[] = rawFieldsOfKind('scalar')

/** Layout distances by scene field, mapped to the raw field uniform scale treats as a length. */
export const LAYOUT_DISTANCE_FIELDS: Readonly<Record<string, RawFieldOfKind<'layout-distance'>>> =
  Object.fromEntries(
    rawFieldsOfKind('layout-distance').map((raw) => [OVERRIDE_FIELDS[raw].scene[0], raw])
  )

/**
 * A component's own identity, which an instance does not take from it: Figma writes these on
 * component records only, and on an instance only its own override key and symbol version.
 * Measured over `gold-preview`, `material3`, `slots`, and `variable-override-precedence`:
 * 26,211 instance records, none carrying the rest.
 */
export const COMPONENT_IDENTITY_FIELDS = [
  'componentKey',
  'sourceLibraryKey',
  'publishID',
  'publishedVersion',
  'sharedSymbolVersion',
  'isSymbolPublishable',
  'variantPropSpecs',
  'componentPropDefs',
  'overrideKey'
] as const

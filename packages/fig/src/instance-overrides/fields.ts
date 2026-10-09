import type { SceneNode } from '@open-pencil/scene-graph'

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
    | 'style'
    | 'paint'
    | 'effects'
    | 'size'
    | 'layout-distance'
    | 'layout-mode'
    | 'layout-align'
    | 'positioning'
    | 'font'
    | 'text-length'
    | 'text-decoration'
    | 'variable-modes'
  /** A placed-space distance that an instance's uniform scale multiplies. */
  readonly length?: true
}

/** Raw override fields an instance owner may claim, keyed by their Kiwi name. */
export const OVERRIDE_FIELDS = {
  name: { scene: ['name'], kind: 'scalar' },
  opacity: { scene: ['opacity'], kind: 'scalar' },
  fontSize: { scene: ['fontSize'], kind: 'scalar', length: true },
  visible: { scene: ['visible'], kind: 'visible' },
  textData: { scene: ['text'], kind: 'text' },
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
  stackPrimaryAlignItems: { scene: ['primaryAxisAlign'], kind: 'layout-align' },
  stackCounterAlignItems: { scene: ['counterAxisAlign'], kind: 'layout-align' },
  stackPositioning: { scene: ['layoutPositioning'], kind: 'positioning' },
  locked: { scene: ['locked'], kind: 'scalar' },
  blendMode: { scene: ['blendMode'], kind: 'scalar' },
  autoRename: { scene: ['autoRename'], kind: 'scalar' },
  strokeWeight: { scene: ['strokeWeight'], kind: 'scalar', length: true },
  strokeAlign: { scene: ['strokeAlign'], kind: 'scalar' },
  strokeCap: { scene: ['strokeCap'], kind: 'scalar' },
  strokeJoin: { scene: ['strokeJoin'], kind: 'scalar' },
  miterLimit: { scene: ['strokeMiterLimit'], kind: 'scalar' },
  dashPattern: { scene: ['dashPattern'], kind: 'scalar', length: true },
  borderStrokeWeightsIndependent: { scene: ['independentStrokeWeights'], kind: 'scalar' },
  borderTopWeight: { scene: ['borderTopWeight'], kind: 'scalar', length: true },
  borderRightWeight: { scene: ['borderRightWeight'], kind: 'scalar', length: true },
  borderBottomWeight: { scene: ['borderBottomWeight'], kind: 'scalar', length: true },
  borderLeftWeight: { scene: ['borderLeftWeight'], kind: 'scalar', length: true },
  cornerRadius: { scene: ['cornerRadius'], kind: 'scalar', length: true },
  cornerSmoothing: { scene: ['cornerSmoothing'], kind: 'scalar' },
  rectangleCornerRadiiIndependent: { scene: ['independentCorners'], kind: 'scalar' },
  rectangleTopLeftCornerRadius: { scene: ['topLeftRadius'], kind: 'scalar', length: true },
  rectangleTopRightCornerRadius: { scene: ['topRightRadius'], kind: 'scalar', length: true },
  rectangleBottomLeftCornerRadius: { scene: ['bottomLeftRadius'], kind: 'scalar', length: true },
  rectangleBottomRightCornerRadius: { scene: ['bottomRightRadius'], kind: 'scalar', length: true },
  effects: { scene: ['effects'], kind: 'effects' },
  styleIdForFill: { scene: ['fillStyleId'], kind: 'style' },
  styleIdForStrokeFill: { scene: ['strokeStyleId'], kind: 'style' },
  styleIdForEffect: { scene: ['effectStyleId'], kind: 'style' },
  styleIdForGrid: { scene: ['gridStyleId'], kind: 'style' },
  fontName: { scene: ['fontFamily', 'fontWeight', 'italic'], kind: 'font' },
  lineHeight: { scene: ['lineHeight'], kind: 'text-length', length: true },
  letterSpacing: { scene: ['letterSpacing'], kind: 'text-length', length: true },
  textDecoration: { scene: ['textDecoration'], kind: 'text-decoration' },
  textAlignHorizontal: { scene: ['textAlignHorizontal'], kind: 'scalar' },
  textAlignVertical: { scene: ['textAlignVertical'], kind: 'scalar' },
  textCase: { scene: ['textCase'], kind: 'scalar' },
  textTruncation: { scene: ['textTruncation'], kind: 'scalar' },
  maxLines: { scene: ['maxLines'], kind: 'scalar' },
  variableModeBySetMap: { scene: ['variableModes'], kind: 'variable-modes' }
} as const satisfies Record<string, OverrideField>

export type RawOverrideField = keyof typeof OVERRIDE_FIELDS

type RawFieldOfKind<K extends OverrideField['kind']> = {
  [R in RawOverrideField]: (typeof OVERRIDE_FIELDS)[R]['kind'] extends K ? R : never
}[RawOverrideField]

const entries = Object.entries(OVERRIDE_FIELDS) as [RawOverrideField, OverrideField][]

/** Scene fields that carry an instance override, with the raw field each serializes to. */
export const SCENE_OVERRIDE_FIELDS: ReadonlyMap<
  keyof SceneNode,
  { raw: RawOverrideField; field: OverrideField }
> = new Map(
  entries.flatMap(([raw, field]) => field.scene.map((scene) => [scene, { raw, field }] as const))
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

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
    | 'paint'
    | 'size'
    | 'layout-distance'
    | 'layout-mode'
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
  stackChildAlignSelf: { scene: ['layoutAlignSelf'], kind: 'layout-mode' }
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

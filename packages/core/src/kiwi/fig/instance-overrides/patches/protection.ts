import type { SceneNode } from '@open-pencil/scene-graph'

export type ProtectedField =
  | 'text'
  | 'visible'
  | 'opacity'
  | 'fills'
  | 'strokes'
  | 'effects'
  | 'styleRuns'
  | 'layoutGrow'
  | 'textAutoResize'
  | 'locked'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'figmaDerivedLayout'
  | 'fontSize'
  | 'lineHeight'
  | 'letterSpacing'
  | 'fillGeometry'
  | 'strokeGeometry'
  | 'structure'

export type ProtectionMap = Map<string, Set<ProtectedField>>

const PROP_TO_PROTECTED_FIELD: Partial<Record<keyof SceneNode, ProtectedField>> = {
  text: 'text',
  visible: 'visible',
  opacity: 'opacity',
  fills: 'fills',
  strokes: 'strokes',
  effects: 'effects',
  styleRuns: 'styleRuns',
  layoutGrow: 'layoutGrow',
  textAutoResize: 'textAutoResize',
  locked: 'locked',
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height',
  figmaDerivedLayout: 'figmaDerivedLayout',
  fontSize: 'fontSize',
  lineHeight: 'lineHeight',
  letterSpacing: 'letterSpacing',
  fillGeometry: 'fillGeometry',
  strokeGeometry: 'strokeGeometry'
}

export function protectField(
  protections: ProtectionMap,
  nodeId: string,
  field: ProtectedField
): void {
  const fields = protections.get(nodeId)
  if (fields) fields.add(field)
  else protections.set(nodeId, new Set([field]))
}

export function protectPatchProps(
  protections: ProtectionMap,
  nodeId: string,
  props: Partial<SceneNode>
): void {
  for (const key of Object.keys(props) as Array<keyof SceneNode>) {
    const field = PROP_TO_PROTECTED_FIELD[key]
    if (field) protectField(protections, nodeId, field)
  }
}

export function isFieldProtected(
  protections: ProtectionMap | undefined,
  nodeId: string,
  field: ProtectedField
): boolean {
  return protections?.get(nodeId)?.has(field) === true
}
